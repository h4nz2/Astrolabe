/**
 * One body's orbit as a closed polyline of 258 points (docs/ARCHITECTURE.md,
 * "Floating origin"). The ellipse is sampled once, in doubles, in the parent's
 * frame at 256 uniform eccentric anomalies, and one extra vertex, the anchor,
 * sits exactly on the body between the two samples that bracket its current
 * anomaly, so the line always passes through the body it belongs to (the
 * chords alone would miss it by up to 7.5e-5 of the semi-major axis: 1.8 Earth
 * radii, 14 Neptune radii).
 *
 * Every rebuild adds the parent's world position, subtracts the render origin
 * (both doubles) and only then rounds to float32. Between rebuilds the line is
 * nudged by the combined origin/parent delta, which is exact because both are
 * pure translations, and only the anchor vertex is rewritten (a 12-byte
 * update range). A rebuild happens when either delta exceeds 1e-4 of the
 * semi-major axis, so vertices near the camera never grow large enough in
 * float32 to jitter, or when the anchor crosses into the next sample interval.
 *
 * Scale (docs/ARCHITECTURE.md, "Scale"): the true samples are mapped into
 * display space with `displayOffset`, the same function that places the body
 * itself, whenever the frame's `scaleVersion` moves on; parent and anchor come
 * from the frame's display positions. The line therefore passes through its
 * body under every scale and never detaches when the scale changes.
 */
import { useMemo, useRef } from "react"
import { extend, useFrame } from "@react-three/fiber"
import { Line, Vector3, type BufferAttribute } from "three"

import type { Body } from "@/data"
import {
	childDistanceCurve,
	displayDistanceKm,
	displayOffset,
	meanAnomalyAt,
	positionAtEccentricAnomaly,
	solveEccentricAnomaly,
	toUnits,
	TWO_PI,
	type DistanceCurve,
	type OrbitElements,
	type Vec3,
} from "@/sim"

import { useSimFrame, type SimFrame } from "../scene/simFrame"

// R3F's createInstance strips the `three` prefix when it mounts <threeLine>,
// but commitUpdate validates the raw type against the catalogue on every
// re-render, so the prefixed name must be registered or the first re-render
// (a layer toggle) throws "ThreeLine is not part of the THREE namespace".
extend({ ThreeLine: Line })

export interface OrbitLineProps {
	body: Body
	index: number
	parentIndex: number
}

export const ORBIT_SEGMENTS = 256
/** Ellipse samples per line: 256 uniform eccentric anomalies plus the closing repeat of the first. */
export const ORBIT_SAMPLES = ORBIT_SEGMENTS + 1
/** Vertices per line: the samples plus the anchor vertex on the body. */
export const ORBIT_POINTS = ORBIT_SAMPLES + 1
/** Rebuild when the origin or the parent moved more than this fraction of the semi-major axis. */
export const ORBIT_REBUILD_FRACTION = 1e-4

export const ORBIT_COLORS = {
	planet: "#8a8f98",
	moon: "#4b5563",
} as const
export const ORBIT_OPACITY = 0.6

const ANOMALY_STEP = TWO_PI / ORBIT_SEGMENTS

const scratch: Vec3 = { x: 0, y: 0, z: 0 }

/**
 * Parent-centric ellipse samples in km (scene axes), 3 doubles per point, at
 * eccentric anomalies 2 pi k / 256 for k = 0..256; the last point repeats the first.
 */
export function sampleOrbit(
	orbit: OrbitElements,
	out: Float64Array = new Float64Array(ORBIT_SAMPLES * 3),
): Float64Array {
	for (let k = 0; k < ORBIT_SEGMENTS; k++) {
		positionAtEccentricAnomaly(orbit, (TWO_PI * k) / ORBIT_SEGMENTS, scratch)
		const o = k * 3
		out[o] = scratch.x
		out[o + 1] = scratch.y
		out[o + 2] = scratch.z
	}
	const last = ORBIT_SEGMENTS * 3
	out[last] = out[0]
	out[last + 1] = out[1]
	out[last + 2] = out[2]
	return out
}

/** The body's eccentric anomaly (radians) at `jd`. */
export const eccentricAnomalyAt = (orbit: OrbitElements, jd: number): number =>
	solveEccentricAnomaly(meanAnomalyAt(orbit, jd), orbit.eccentricity)

/**
 * The sample interval holding eccentric anomaly E: the anchor vertex is
 * inserted after sample `slot` (0..255), i.e. at vertex `slot + 1`.
 */
export const anchorSlot = (eccentricAnomaly: number): number =>
	Math.min(
		ORBIT_SEGMENTS - 1,
		Math.max(0, Math.floor(eccentricAnomaly / ANOMALY_STEP)),
	)

/** Vertex index of the anchor for the given slot. */
export const anchorVertex = (slot: number): number => slot + 1

export interface OrbitBuffers {
	/** Parent-centric samples, TRUE km, doubles (ORBIT_SAMPLES points). */
	samples: Float64Array
	/** The same samples mapped into display space (display km) for the scale of `scaleVersion`. */
	displaySamples: Float64Array
	/** Drawn semi-major axis (display km); sets the rebuild threshold. */
	displaySemiMajorAxisKm: number
	/** The frame's `scaleVersion` the display samples were mapped for; -1 before the first mapping. */
	scaleVersion: number
	/** The float32 vertices handed to the GPU (ORBIT_POINTS), scene units, relative to the origin at the last rebuild. */
	positions: Float32Array
	originAtRebuild: Float64Array
	parentAtRebuild: Float64Array
	/** Sample the anchor vertex follows (see `anchorSlot`); -1 before the first build. */
	slot: number
	built: boolean
}

export const createOrbitBuffers = (orbit: OrbitElements): OrbitBuffers => ({
	samples: sampleOrbit(orbit),
	displaySamples: new Float64Array(ORBIT_SAMPLES * 3),
	displaySemiMajorAxisKm: orbit.semiMajorAxisKm,
	scaleVersion: -1,
	positions: new Float32Array(ORBIT_POINTS * 3),
	originAtRebuild: new Float64Array(3),
	parentAtRebuild: new Float64Array(3),
	slot: -1,
	built: false,
})

/**
 * Maps parent-centric true samples into display space (`out`, same layout)
 * with `displayOffset`, the function that places every body.
 */
export function mapOrbitSamples(
	samples: Float64Array,
	out: Float64Array,
	parentRadiusKm: number,
	parentDisplayRadiusKm: number,
	curve: DistanceCurve,
): Float64Array {
	for (let s = 0; s < samples.length; s += 3) {
		displayOffset(
			samples[s],
			samples[s + 1],
			samples[s + 2],
			parentRadiusKm,
			parentDisplayRadiusKm,
			curve,
			out,
			s,
		)
	}
	return out
}

/** What `updateOrbitBuffers` reads of the SimFrame. */
export type OrbitFrame = Pick<
	SimFrame,
	| "bodies"
	| "displayKm"
	| "displayRadiiKm"
	| "originKm"
	| "jd"
	| "scale"
	| "scaleVersion"
>

/**
 * Re-maps the display samples when the frame's scale changed since the last
 * mapping. Returns true when it did (the vertices must then be rebuilt).
 */
function syncOrbitScale(
	buffers: OrbitBuffers,
	orbit: OrbitElements,
	frame: OrbitFrame,
	parentIndex: number,
): boolean {
	if (buffers.scaleVersion === frame.scaleVersion) return false
	const parent = frame.bodies[parentIndex]
	const parentDisplayRadius = frame.displayRadiiKm[parentIndex]
	const curve = childDistanceCurve(frame.scale, parent.parentId === null)
	mapOrbitSamples(
		buffers.samples,
		buffers.displaySamples,
		parent.radiusKm,
		parentDisplayRadius,
		curve,
	)
	buffers.displaySemiMajorAxisKm = displayDistanceKm(
		orbit.semiMajorAxisKm,
		parent.radiusKm,
		parentDisplayRadius,
		curve,
	)
	buffers.scaleVersion = frame.scaleVersion
	return true
}

/**
 * Brings the line up to date with the frame. Returns true when all vertices
 * were rebuilt (the whole attribute must be re-uploaded and the line sits at
 * the origin); otherwise only the anchor vertex (`anchorVertex(buffers.slot)`)
 * changed and the translation to apply to the line, in scene units, is
 * written into `shift`. In both cases the anchor's render position equals the
 * body's (`frame.renderPosition(index)`) in doubles.
 */
export function updateOrbitBuffers(
	buffers: OrbitBuffers,
	orbit: OrbitElements,
	frame: OrbitFrame,
	index: number,
	parentIndex: number,
	shift: Vec3,
): boolean {
	const rescaled = syncOrbitScale(buffers, orbit, frame, parentIndex)
	const { displayKm, originKm } = frame
	const p = parentIndex * 3
	const px = displayKm[p]
	const py = displayKm[p + 1]
	const pz = displayKm[p + 2]
	const b = index * 3
	// the body relative to its parent: the drawn ellipse point at the current anomaly
	const rx = displayKm[b] - px
	const ry = displayKm[b + 1] - py
	const rz = displayKm[b + 2] - pz
	const ox = originKm[0]
	const oy = originKm[1]
	const oz = originKm[2]
	const slot = anchorSlot(eccentricAnomalyAt(orbit, frame.jd))

	const { originAtRebuild, parentAtRebuild, positions } = buffers
	const dox = ox - originAtRebuild[0]
	const doy = oy - originAtRebuild[1]
	const doz = oz - originAtRebuild[2]
	const dpx = px - parentAtRebuild[0]
	const dpy = py - parentAtRebuild[1]
	const dpz = pz - parentAtRebuild[2]
	const threshold = ORBIT_REBUILD_FRACTION * buffers.displaySemiMajorAxisKm
	const thresholdSq = threshold * threshold
	const originMoved = dox * dox + doy * doy + doz * doz > thresholdSq
	const parentMoved = dpx * dpx + dpy * dpy + dpz * dpz > thresholdSq

	if (
		buffers.built &&
		!rescaled &&
		!originMoved &&
		!parentMoved &&
		slot === buffers.slot
	) {
		// the ellipse moved with its parent, the origin moved on its own: shift by the difference
		shift.x = toUnits(dpx - dox)
		shift.y = toUnits(dpy - doy)
		shift.z = toUnits(dpz - doz)
		// the anchor rides along the ellipse in the line's own (rebuild-time) frame
		const a = anchorVertex(slot) * 3
		positions[a] = toUnits(rx + parentAtRebuild[0] - originAtRebuild[0])
		positions[a + 1] = toUnits(ry + parentAtRebuild[1] - originAtRebuild[1])
		positions[a + 2] = toUnits(rz + parentAtRebuild[2] - originAtRebuild[2])
		return false
	}

	const samples = buffers.displaySamples
	// samples 0..slot, the anchor, then samples slot+1..256
	for (let k = 0; k <= slot; k++) {
		const s = k * 3
		positions[s] = toUnits(samples[s] + px - ox)
		positions[s + 1] = toUnits(samples[s + 1] + py - oy)
		positions[s + 2] = toUnits(samples[s + 2] + pz - oz)
	}
	const a = anchorVertex(slot) * 3
	positions[a] = toUnits(rx + px - ox)
	positions[a + 1] = toUnits(ry + py - oy)
	positions[a + 2] = toUnits(rz + pz - oz)
	for (let k = slot + 1; k < ORBIT_SAMPLES; k++) {
		const s = k * 3
		const v = s + 3
		positions[v] = toUnits(samples[s] + px - ox)
		positions[v + 1] = toUnits(samples[s + 1] + py - oy)
		positions[v + 2] = toUnits(samples[s + 2] + pz - oz)
	}
	originAtRebuild[0] = ox
	originAtRebuild[1] = oy
	originAtRebuild[2] = oz
	parentAtRebuild[0] = px
	parentAtRebuild[1] = py
	parentAtRebuild[2] = pz
	buffers.slot = slot
	buffers.built = true
	shift.x = 0
	shift.y = 0
	shift.z = 0
	return true
}

const shift = new Vector3()

function OrbitLine({ body, index, parentIndex }: OrbitLineProps) {
	const frame = useSimFrame()
	const lineRef = useRef<Line>(null)
	const attributeRef = useRef<BufferAttribute>(null)
	const orbit = body.orbit
	const buffers = useMemo(
		() => (orbit === null ? null : createOrbitBuffers(orbit)),
		[orbit],
	)

	useFrame(() => {
		const line = lineRef.current
		const attribute = attributeRef.current
		if (
			line === null ||
			attribute === null ||
			buffers === null ||
			orbit === null
		) {
			return
		}
		const rebuilt = updateOrbitBuffers(
			buffers,
			orbit,
			frame,
			index,
			parentIndex,
			shift,
		)
		// a rebuild uploads everything (no ranges); otherwise only the anchor's 3 floats
		if (rebuilt) attribute.clearUpdateRanges()
		else attribute.addUpdateRange(anchorVertex(buffers.slot) * 3, 3)
		attribute.needsUpdate = true
		line.position.copy(shift)
	})

	if (buffers === null) return null

	return (
		<threeLine ref={lineRef} frustumCulled={false}>
			<bufferGeometry>
				<bufferAttribute
					ref={attributeRef}
					attach="attributes-position"
					args={[buffers.positions, 3]}
				/>
			</bufferGeometry>
			<lineBasicMaterial
				color={body.kind === "moon" ? ORBIT_COLORS.moon : ORBIT_COLORS.planet}
				transparent
				opacity={ORBIT_OPACITY}
			/>
		</threeLine>
	)
}

export default OrbitLine
