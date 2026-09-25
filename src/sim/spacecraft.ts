/**
 * Spacecraft positions (issue #35, docs/ARCHITECTURE.md, "Spacecraft"). Pure:
 * no React, no three.js; per-frame functions write into caller-owned arrays.
 *
 * A trajectory is a list of segments of sparse Horizons states, each relative
 * to a centre body: the Sun (the root), or a planet while the craft is in its
 * neighbourhood. Between samples the state is rebuilt by cubic Hermite
 * interpolation (./hermite.ts). A craft is placed like any other non-body
 * point near an anchor (docs/ARCHITECTURE.md, "Scale"): at the centre's
 * position plus its offset from the centre, mapped through `displayOffset`
 * with the centre as the parent. So a flyby passes the DRAWN planet at the
 * true miss distance (scaled like a moon at that distance would be) in every
 * preset, and the true position (for readouts: distances, signal delay) uses
 * the true one.
 *
 * Near a planet two segments overlap: the planet's and the Sun's. Inside the
 * planet segment's inner radius (1 Hill radius) only the planet's counts,
 * beyond its outer radius (1.5) only the Sun's, and in between their positions
 * blend with a smoothstep of the distance, so nothing jumps where one frame
 * hands over to the other (the planets come from the app's Kepler model,
 * which differs from JPL's by up to a few tenths of a degree).
 *
 * Only the Sun and its direct children (planets) may be centres: their
 * position at any time is one Kepler propagation, which the path builder
 * needs for every vertex.
 */
import type { Body } from "@/data"
import type {
	Spacecraft,
	SpacecraftEvent,
	TrajectorySegment,
} from "@/data/spacecraftSchema"

import { bracket, hermitePosition, hermiteVelocity } from "./hermite"
import { propagate, type Vec3 } from "./kepler"
import { childDistanceCurve, displayOffset, type ScaleSettings } from "./scale"
import { J2000_JD, UNIX_EPOCH_JD, MS_PER_DAY } from "./time"
import { AU_KM } from "./units"

/** Speed of light, km/s. */
export const LIGHT_SPEED_KM_S = 299_792.458

/** Julian Date of an ISO instant (`1977-09-05T12:56Z`). */
export const isoToJD = (iso: string): number =>
	UNIX_EPOCH_JD + Date.parse(iso) / MS_PER_DAY

/** A decoded segment: JDs and scene-axis states, ready for interpolation. */
export interface CraftSegment {
	readonly center: string
	/** Index of the centre in the bodies array the trajectory was bound to. */
	readonly centerIndex: number
	/** The centre is the root (the Sun). */
	readonly root: boolean
	/** km; `inner = outer = Infinity` when the segment alone places the craft. */
	readonly inner: number
	readonly outer: number
	readonly jd: Float64Array
	/** km, scene axes, 3 per sample. */
	readonly p: Float64Array
	/** km/s, scene axes, 3 per sample. */
	readonly v: Float64Array
	readonly from: number
	readonly to: number
}

export interface CraftTrajectory {
	readonly id: string
	/** Segments centred on the root (the Sun), in time order. */
	readonly helio: readonly CraftSegment[]
	/** Segments centred on a planet, in time order. */
	readonly planetary: readonly CraftSegment[]
	/** The data covers [fromJD, toJD]. */
	readonly fromJD: number
	readonly toJD: number
}

/** Ecliptic (x, y, z) -> scene (x, z, -y) for a flat array of vectors. */
function eclipticArrayToScene(values: readonly number[]): Float64Array {
	const out = new Float64Array(values.length)
	for (let k = 0; k < values.length; k += 3) {
		out[k] = values[k]
		out[k + 1] = values[k + 2]
		out[k + 2] = -values[k + 1]
	}
	return out
}

function decodeSegment(
	segment: TrajectorySegment,
	index: ReadonlyMap<string, number>,
	bodies: readonly Pick<Body, "parentId">[],
): CraftSegment {
	const centerIndex = index.get(segment.center)
	if (centerIndex === undefined) {
		throw new Error(`spacecraft: unknown centre "${segment.center}"`)
	}
	const center = bodies[centerIndex]
	const root = center.parentId === null
	const parent =
		center.parentId === null ? undefined : index.get(center.parentId)
	if (!root && (parent === undefined || bodies[parent].parentId !== null)) {
		throw new Error(
			`spacecraft: centre "${segment.center}" must be the root or orbit it`,
		)
	}
	const jd = Float64Array.from(segment.t, (t) => t + J2000_JD)
	return {
		center: segment.center,
		centerIndex,
		root,
		inner: segment.blend === null ? Infinity : segment.blend[0],
		outer: segment.blend === null ? Infinity : segment.blend[1],
		jd,
		p: eclipticArrayToScene(segment.p),
		v: eclipticArrayToScene(segment.v),
		from: jd[0],
		to: jd[jd.length - 1],
	}
}

/** Decodes a craft's trajectory `segments` against `bodies` (their `index`, as from `buildIndex`). */
export function decodeTrajectory(
	craft: Pick<Spacecraft, "id" | "dataFrom" | "dataTo">,
	data: readonly TrajectorySegment[],
	bodies: readonly Pick<Body, "parentId">[],
	index: ReadonlyMap<string, number>,
): CraftTrajectory {
	const segments = data.map((segment) => decodeSegment(segment, index, bodies))
	const byStart = (a: CraftSegment, b: CraftSegment) => a.from - b.from
	return {
		id: craft.id,
		helio: segments.filter((s) => s.root).sort(byStart),
		planetary: segments.filter((s) => !s.root).sort(byStart),
		fromJD: Math.max(
			isoToJD(craft.dataFrom),
			Math.min(...segments.map((s) => s.from)),
		),
		toJD: Math.min(
			isoToJD(craft.dataTo),
			Math.max(...segments.map((s) => s.to)),
		),
	}
}

const covering = (
	segments: readonly CraftSegment[],
	jd: number,
): CraftSegment | null => {
	for (const segment of segments) {
		if (jd >= segment.from && jd <= segment.to) return segment
	}
	return null
}

/** State of `segment` at `jd` relative to its centre: position (km) into `p`, velocity (km/s) into `v`. */
export function segmentState(
	segment: CraftSegment,
	jd: number,
	p: Float64Array,
	v?: Float64Array,
): void {
	const i = bracket(segment.jd, jd)
	hermitePosition(segment.jd, segment.p, segment.v, i, i + 1, jd, p)
	if (v !== undefined) {
		hermiteVelocity(segment.jd, segment.p, segment.v, i, i + 1, jd, v)
	}
}

/**
 * Weight (0..1) of a planet segment against the Sun's at distance `d` km
 * from the planet: 1 inside `inner`, 0 beyond `outer`, a smoothstep between.
 */
export function blendWeight(inner: number, outer: number, d: number): number {
	if (!(d > inner)) return 1
	if (!(d < outer)) return 0
	const x = (outer - d) / (outer - inner)
	return x * x * (3 - 2 * x)
}

/** Where the centres are, at the time being evaluated. */
export interface CentreFrame {
	readonly bodies: readonly Pick<Body, "radiusKm" | "parentId" | "orbit">[]
	/** True positions (km, scene axes), 3 per body. */
	readonly positionsKm: ArrayLike<number>
	/** Display positions (display km), 3 per body. */
	readonly displayKm: ArrayLike<number>
	readonly displayRadiiKm: ArrayLike<number>
	readonly scale: ScaleSettings
}

/** The state of a craft at one instant (written by `craftStateAt`). */
export interface CraftState {
	/** Inside the data range: false before `fromJD`, after `toJD`. */
	available: boolean
	/** True position (km, scene axes, the same frame as `positionsKm`). */
	readonly trueKm: Float64Array
	/** Velocity (km/s, scene axes) relative to the anchor (`anchorIndex`): the Sun, or the planet it is near. */
	readonly velocityKmS: Float64Array
	/** Drawn position (display km). */
	readonly displayKm: Float64Array
	/**
	 * The body the craft is placed around most (the planet while its segment
	 * weighs at least half, else the root): the neighbourhood it is in.
	 */
	anchorIndex: number
	/** Weight of the planet segment (0 when only the Sun's applies). */
	planetWeight: number
}

export const createCraftState = (): CraftState => ({
	available: false,
	trueKm: new Float64Array(3),
	velocityKmS: new Float64Array(3),
	displayKm: new Float64Array(3),
	anchorIndex: -1,
	planetWeight: 0,
})

const rel = new Float64Array(3)
const vel = new Float64Array(3)
const mapped = new Float64Array(3)

/**
 * Adds `weight` x (centre + offset `rel`) to the true position and
 * `weight` x (drawn centre + `displayOffset(rel)`) to the drawn position.
 */
function accumulate(
	state: CraftState,
	segment: CraftSegment,
	frame: CentreFrame,
	centreTrue: ArrayLike<number>,
	centreDisplay: ArrayLike<number>,
	weight: number,
): void {
	const c = segment.centerIndex
	const body = frame.bodies[c]
	displayOffset(
		rel[0],
		rel[1],
		rel[2],
		body.radiusKm,
		frame.displayRadiiKm[c],
		childDistanceCurve(frame.scale, segment.root),
		mapped,
	)
	for (let k = 0; k < 3; k++) {
		state.trueKm[k] += weight * (centreTrue[k] + rel[k])
		state.displayKm[k] += weight * (centreDisplay[k] + mapped[k])
	}
}

const centreTrueScratch = new Float64Array(3)
const centreDisplayScratch = new Float64Array(3)

/** Reads a body's true and drawn position out of the frame. */
function centreOf(frame: CentreFrame, i: number): void {
	const o = i * 3
	for (let k = 0; k < 3; k++) {
		centreTrueScratch[k] = frame.positionsKm[o + k]
		centreDisplayScratch[k] = frame.displayKm[o + k]
	}
}

/**
 * The craft's true and drawn position at `jd`, with the centres where `frame`
 * has them (so `frame` must be at `jd` for the craft to sit right among the
 * bodies). Outside the data range `available` is false and nothing else is
 * written.
 */
export function craftStateAt(
	trajectory: CraftTrajectory,
	jd: number,
	frame: CentreFrame,
	state: CraftState,
	centres: (frame: CentreFrame, index: number) => void = centreOf,
): CraftState {
	if (!(jd >= trajectory.fromJD && jd <= trajectory.toJD)) {
		state.available = false
		return state
	}
	const planet = covering(trajectory.planetary, jd)
	const helio = covering(trajectory.helio, jd)
	let weight = 0
	if (planet !== null) {
		segmentState(planet, jd, rel)
		weight = blendWeight(
			planet.inner,
			planet.outer,
			Math.hypot(rel[0], rel[1], rel[2]),
		)
		if (helio === null) weight = 1
	}
	if (planet === null && helio === null) {
		state.available = false
		return state
	}
	state.available = true
	state.trueKm.fill(0)
	state.displayKm.fill(0)
	const anchor = planet !== null && weight >= 0.5 ? planet : (helio ?? planet)!
	if (planet !== null && weight > 0) {
		segmentState(planet, jd, rel)
		centres(frame, planet.centerIndex)
		accumulate(
			state,
			planet,
			frame,
			centreTrueScratch,
			centreDisplayScratch,
			weight,
		)
	}
	if (helio !== null && weight < 1) {
		segmentState(helio, jd, rel)
		centres(frame, helio.centerIndex)
		accumulate(
			state,
			helio,
			frame,
			centreTrueScratch,
			centreDisplayScratch,
			1 - weight,
		)
	}
	segmentState(anchor, jd, rel, vel)
	state.velocityKmS.set(vel)
	state.planetWeight = weight
	state.anchorIndex = anchor.centerIndex
	return state
}

/**
 * A centre lookup for another time than the frame's (for drawing a whole
 * path): the root stays where the frame has it, a planet is propagated from
 * its orbit to `jd` and drawn through the scale engine like the frame draws
 * it. Set `jd` before each `craftStateAt` call.
 */
export interface CentresAt {
	jd: number
	readonly lookup: (frame: CentreFrame, index: number) => void
}

export function createCentresAt(rootIndex: number): CentresAt {
	const planet: Vec3 = { x: 0, y: 0, z: 0 }
	const at: CentresAt = {
		jd: J2000_JD,
		lookup: (frame, i) => {
			const r = rootIndex * 3
			for (let k = 0; k < 3; k++) {
				centreTrueScratch[k] = frame.positionsKm[r + k]
				centreDisplayScratch[k] = frame.displayKm[r + k]
			}
			const body = frame.bodies[i]
			if (i === rootIndex || body.orbit === null) return
			propagate(body.orbit, at.jd, planet)
			const root = frame.bodies[rootIndex]
			displayOffset(
				planet.x,
				planet.y,
				planet.z,
				root.radiusKm,
				frame.displayRadiiKm[rootIndex],
				childDistanceCurve(frame.scale, true),
				mapped,
			)
			centreTrueScratch[0] += planet.x
			centreTrueScratch[1] += planet.y
			centreTrueScratch[2] += planet.z
			for (let k = 0; k < 3; k++) centreDisplayScratch[k] += mapped[k]
		},
	}
	return at
}

/** A path vertex is added wherever the craft turns by more than this around its centre (radians). */
export const PATH_MAX_TURN_RAD = 0.05
/** At most this many vertices between two stored samples. */
export const PATH_MAX_SUBDIVISIONS = 64

/**
 * Times (JD, ascending) at which to draw the path of `segments` between
 * `from` and `to`: every stored sample, and in between as many as keep the
 * turn around the centre per vertex under `PATH_MAX_TURN_RAD`.
 */
export function pathTimes(
	segments: readonly CraftSegment[],
	from: number,
	to: number,
): number[] {
	const times: number[] = []
	for (const segment of segments) {
		const { jd } = segment
		for (let i = 0; i + 1 < jd.length; i++) {
			if (jd[i + 1] < from || jd[i] > to) continue
			const a = i * 3
			const b = a + 3
			const r = Math.min(
				Math.hypot(segment.p[a], segment.p[a + 1], segment.p[a + 2]),
				Math.hypot(segment.p[b], segment.p[b + 1], segment.p[b + 2]),
			)
			const speed = Math.max(
				Math.hypot(segment.v[a], segment.v[a + 1], segment.v[a + 2]),
				Math.hypot(segment.v[b], segment.v[b + 1], segment.v[b + 2]),
			)
			const turn = (speed * (jd[i + 1] - jd[i]) * 86400) / Math.max(r, 1)
			const pieces = Math.min(
				PATH_MAX_SUBDIVISIONS,
				Math.max(1, Math.ceil(turn / PATH_MAX_TURN_RAD)),
			)
			for (let k = 0; k <= pieces; k++) {
				const t = jd[i] + ((jd[i + 1] - jd[i]) * k) / pieces
				if (t >= from && t <= to) times.push(t)
			}
		}
	}
	times.sort((a, b) => a - b)
	// drop repeats (segment edges, overlaps)
	return times.filter((t, k) => k === 0 || t - times[k - 1] > 1e-7)
}

/**
 * Drawn positions (display km, 3 per time) of the craft at each of `times`,
 * each with the centres where they were at that time: a static path under the
 * frame's scale. Times without data repeat the previous vertex.
 */
export function fillPath(
	trajectory: CraftTrajectory,
	times: readonly number[],
	frame: CentreFrame,
	rootIndex: number,
	out: Float64Array,
): Float64Array {
	const centres = createCentresAt(rootIndex)
	const state = createCraftState()
	for (let k = 0; k < times.length; k++) {
		centres.jd = times[k]
		craftStateAt(trajectory, times[k], frame, state, centres.lookup)
		const o = k * 3
		if (state.available) {
			out[o] = state.displayKm[0]
			out[o + 1] = state.displayKm[1]
			out[o + 2] = state.displayKm[2]
		} else if (k > 0) {
			out[o] = out[o - 3]
			out[o + 1] = out[o - 2]
			out[o + 2] = out[o - 1]
		}
	}
	return out
}

/**
 * A track around a planet at the frame's time: the craft's offsets from the
 * planet at each of `times` (one planet segment), drawn around where the
 * planet is NOW, the way a moon's orbit line is drawn. Writes display km,
 * 3 per time, into `out` and returns how many were written.
 */
export function fillTrack(
	segment: CraftSegment,
	times: ArrayLike<number>,
	frame: CentreFrame,
	out: Float64Array,
): number {
	const c = segment.centerIndex
	const body = frame.bodies[c]
	const curve = childDistanceCurve(frame.scale, segment.root)
	let written = 0
	for (let i = 0; i < times.length; i++) {
		const t = times[i]
		if (t < segment.from || t > segment.to) continue
		segmentState(segment, t, rel)
		displayOffset(
			rel[0],
			rel[1],
			rel[2],
			body.radiusKm,
			frame.displayRadiiKm[c],
			curve,
			mapped,
		)
		const o = written * 3
		for (let k = 0; k < 3; k++) {
			out[o + k] = frame.displayKm[c * 3 + k] + mapped[k]
		}
		written++
	}
	return written
}

/** What a craft is at `jd`, for the status line and for whether it is drawn. */
export type CraftPhase =
	/** Before launch. */
	| "planned"
	/** Launched, operating. */
	| "active"
	/** Mission over, the craft flies on unheard (Pioneer 10 and 11). */
	| "silent"
	/** Mission over, the craft no longer exists (Cassini). */
	| "destroyed"

export function craftPhase(
	craft: Pick<Spacecraft, "launch" | "end">,
	jd: number,
): CraftPhase {
	if (jd < isoToJD(craft.launch)) return "planned"
	if (craft.end === null || jd < isoToJD(craft.end.date)) return "active"
	return craft.end.kind
}

/** Whether a craft in `phase` exists in space (is drawn), given a position. */
export const isInSpace = (phase: CraftPhase): boolean =>
	phase === "active" || phase === "silent"

/** One-way light (radio) time between two true positions, seconds. */
export function lightTimeSeconds(
	a: ArrayLike<number>,
	b: ArrayLike<number>,
): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / LIGHT_SPEED_KM_S
}

/** Distance between two true positions, km. */
export const distanceKm = (
	a: ArrayLike<number>,
	b: ArrayLike<number>,
): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export const kmToAuValue = (km: number): number => km / AU_KM

/** Events in time order with their Julian Dates. */
export const eventsWithJD = (
	events: readonly SpacecraftEvent[],
): (SpacecraftEvent & { jd: number })[] =>
	events
		.map((event) => ({ ...event, jd: isoToJD(event.date) }))
		.sort((a, b) => a.jd - b.jd)
