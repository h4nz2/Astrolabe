/**
 * Where an orbit's name is written (the optional orbit names, #20): on the
 * drawn orbit line itself, at the line's leftmost point on screen that leaves
 * room for the whole name. A point fixed by the camera, not by the body, so the
 * name stays put while time runs, and in the overview the names of all eight
 * orbits line up along the left of the Sun like a ruler. The samples are the
 * orbit line's own (bodies/OrbitLine.tsx: `sampleOrbit` mapped through
 * `displayOffset`), so the name sits on the line in every scale preset.
 */
import { PerspectiveCamera, Vector3 } from "three"

import { childDistanceCurve, toUnits } from "@/sim"

import { mapOrbitSamples, sampleOrbit } from "../bodies/OrbitLine"
import type { SimFrame } from "../scene/simFrame"

/** Every how many orbit-line samples one is tried as the anchor (256 / 4 = 64 per orbit). */
export const ORBIT_ANCHOR_STRIDE = 4

export interface OrbitAnchorCache {
	/** Display-space samples relative to the parent, per body index (lazily built). */
	readonly samples: (Float64Array | null)[]
	/** The frame's `scaleVersion` each body's samples were mapped for. */
	readonly versions: Int32Array
}

export const createOrbitAnchorCache = (count: number): OrbitAnchorCache => ({
	samples: new Array<Float64Array | null>(count).fill(null),
	versions: new Int32Array(count).fill(-1),
})

/** Body `i`'s display samples for the frame's current scale, or null without an orbit. */
function displaySamples(
	cache: OrbitAnchorCache,
	frame: SimFrame,
	i: number,
): Float64Array | null {
	const body = frame.bodies[i]
	if (body.orbit === null || body.parentId === null) return null
	const p = frame.index.get(body.parentId)
	if (p === undefined) return null
	let samples = cache.samples[i]
	if (samples !== null && cache.versions[i] === frame.scaleVersion) {
		return samples
	}
	const parent = frame.bodies[p]
	const truth = sampleOrbit(body.orbit)
	samples = mapOrbitSamples(
		truth,
		samples ?? new Float64Array(truth.length),
		parent.radiusKm,
		frame.displayRadiiKm[p],
		childDistanceCurve(frame.scale, parent.parentId === null),
	)
	cache.samples[i] = samples
	cache.versions[i] = frame.scaleVersion
	return samples
}

const point = new Vector3()

export interface OrbitAnchor {
	x: number
	y: number
	/** Distance from the camera (scene units). */
	depth: number
}

/**
 * The screen point (px) where body `i`'s orbit name goes, written into `out`:
 * the leftmost sample in front of the camera whose `width` x `height` box,
 * centred on it, fits inside the viewport with `margin`. False when none does.
 * The camera's matrices must be current.
 */
export function orbitAnchor(
	cache: OrbitAnchorCache,
	frame: SimFrame,
	camera: PerspectiveCamera,
	i: number,
	viewport: { width: number; height: number; margin: number },
	box: { width: number; height: number },
	out: OrbitAnchor,
): boolean {
	const samples = displaySamples(cache, frame, i)
	const parentId = frame.bodies[i].parentId
	if (samples === null || parentId === null) return false
	const p = frame.index.get(parentId)
	if (p === undefined) return false
	const { displayKm, originKm } = frame
	const px = displayKm[p * 3] - originKm[0]
	const py = displayKm[p * 3 + 1] - originKm[1]
	const pz = displayKm[p * 3 + 2] - originKm[2]
	const { width, height, margin } = viewport
	const halfW = box.width / 2
	const halfH = box.height / 2
	let found = false
	out.x = Infinity
	// the last sample repeats the first
	for (let s = 0; s < samples.length - 3; s += 3 * ORBIT_ANCHOR_STRIDE) {
		point
			.set(
				toUnits(px + samples[s]),
				toUnits(py + samples[s + 1]),
				toUnits(pz + samples[s + 2]),
			)
			.applyMatrix4(camera.matrixWorldInverse)
		if (-point.z <= camera.near) continue
		const depth = point.length()
		point.applyMatrix4(camera.projectionMatrix)
		const x = ((point.x + 1) / 2) * width
		const y = ((1 - point.y) / 2) * height
		if (
			x < out.x &&
			x - halfW >= margin &&
			x + halfW <= width - margin &&
			y - halfH >= margin &&
			y + halfH <= height - margin
		) {
			out.x = x
			out.y = y
			out.depth = depth
			found = true
		}
	}
	return found
}
