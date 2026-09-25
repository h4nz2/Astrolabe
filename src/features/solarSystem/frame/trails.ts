/**
 * Trails (#31): where every planet and the Sun have been, as seen from the
 * body the reference frame holds still. In the Sun-centred frame a planet's
 * path is its orbit (the orbit lines); held still on Earth, the paths become
 * the sky's motions: the Sun's yearly circle, Venus's and Mercury's
 * flowers and Mars's retrograde loop, which exists only as such a trace.
 *
 * A trail is a pure function of simulation time, not a recording of frames:
 * the path over the window `trailWindow(jd, sinceJD)` sampled on a fixed grid
 * of `TRAIL_STEP_DAYS`, plus the exact current position as its head. So it is
 * the same at any frame rate, runs backwards, survives time jumps and deep
 * links, and opening a frame shows the last two years at once. The grid is
 * slid incrementally (only new days are computed) and recomputed as a whole
 * only after a jump longer than the window or a change of anchor.
 *
 * Samples are TRUE offsets from the anchor planet (the top-level body the
 * frame holds still), drawn like every body in that frame
 * (`framedOffset`, src/sim/referenceFrame.ts): their directions are the true
 * directions in the sky, in every scale preset.
 */
import { SMALL_BODY_KINDS, type Body } from "@/data"
import { toUnits, type ScaleSettings } from "@/sim"
import { bodyPositionAt, framedOffset } from "@/sim/referenceFrame"

/** Grid spacing of the samples, days: smooth enough for Mercury's three-week loops. */
export const TRAIL_STEP_DAYS = 1
/** How far back a trail reaches, days: two years, one of Mars's loops and two of the Sun's circles. */
export const TRAIL_LENGTH_DAYS = 2 * 365.25
/** Grid samples a trail holds at most. */
export const TRAIL_CAPACITY =
	Math.floor(TRAIL_LENGTH_DAYS / TRAIL_STEP_DAYS) + 1
/** Vertices per trail line: the samples plus the head on the body itself. */
export const TRAIL_VERTICES = TRAIL_CAPACITY + 1

/**
 * The span of time a trail shows, [from, to] in JD: the last
 * `TRAIL_LENGTH_DAYS` before `jd`, but never before `sinceJD` (a restarted
 * trail grows from there). Running backwards past `sinceJD` shows the span
 * from `jd` up to it instead, so a trail always covers where the bodies went
 * since it was restarted.
 */
export function trailWindow(
	jd: number,
	sinceJD: number | null,
	lengthDays: number = TRAIL_LENGTH_DAYS,
): [number, number] {
	if (sinceJD === null || !Number.isFinite(sinceJD))
		return [jd - lengthDays, jd]
	if (jd >= sinceJD) return [Math.max(sinceJD, jd - lengthDays), jd]
	return [jd, Math.min(sinceJD, jd + lengthDays)]
}

/** What the trails read of the SimFrame. */
export interface TrailFrame {
	readonly bodies: readonly Body[]
	readonly index: ReadonlyMap<string, number>
	readonly topIndex: Int32Array
	readonly positionsKm: Float64Array
	readonly scale: ScaleSettings
	readonly scaleVersion: number
	readonly jd: number
}

export interface TrailBuffers {
	/** Body index of every trail: the root and each top-level body, in `bodies` order. */
	readonly bodies: Int32Array
	/** Top-level body the samples are relative to; -1 before the first update. */
	anchor: number
	/** Grid index (JD / step) of the oldest held sample, and how many are held. */
	first: number
	count: number
	/** TRUE offsets from the anchor, km: ring buffers of TRAIL_CAPACITY per trail, slot = grid mod capacity. */
	readonly samplesKm: Float64Array
	/** Scene units relative to the anchor's drawn position: TRAIL_VERTICES per trail, in time order, head last (or first when running back). */
	readonly positions: Float32Array
	/** Vertices drawn per trail (0: nothing), the same for all. */
	vertexCount: number
	/** Index of the head vertex within a trail (0 or vertexCount - 1). */
	headVertex: number
	/** The scale version and the grid range the positions were last written for. */
	writtenVersion: number
	writtenFirst: number
	writtenCount: number
}

/**
 * The bodies that get a trail: the root (the Sun) and every top-level body, except the
 * small bodies (#23): seventeen more loops would bury the planets' ones.
 */
export const trailBodies = (
	frame: Pick<TrailFrame, "topIndex"> & Partial<Pick<TrailFrame, "bodies">>,
): Int32Array => {
	const list: number[] = []
	frame.topIndex.forEach((top, i) => {
		const kind = frame.bodies?.[i]?.kind
		if (top === i && (kind === undefined || !SMALL_BODY_KINDS.includes(kind))) {
			list.push(i)
		}
	})
	return Int32Array.from(list)
}

export function createTrailBuffers(bodies: Int32Array): TrailBuffers {
	return {
		bodies,
		anchor: -1,
		first: 0,
		count: 0,
		samplesKm: new Float64Array(bodies.length * TRAIL_CAPACITY * 3),
		positions: new Float32Array(bodies.length * TRAIL_VERTICES * 3),
		vertexCount: 0,
		headVertex: 0,
		writtenVersion: -1,
		writtenFirst: 0,
		writtenCount: -1,
	}
}

const anchorKm = new Float64Array(3)
const bodyKm = new Float64Array(3)
const drawn = new Float64Array(3)

/** Computes the samples of grid index `g` for every trail (true offsets from the anchor). */
function sample(buffers: TrailBuffers, frame: TrailFrame, g: number): void {
	const jd = g * TRAIL_STEP_DAYS
	const { bodies, index } = frame
	bodyPositionAt(bodies, index, buffers.anchor, jd, anchorKm)
	const slot = ((g % TRAIL_CAPACITY) + TRAIL_CAPACITY) % TRAIL_CAPACITY
	for (let t = 0; t < buffers.bodies.length; t++) {
		const i = buffers.bodies[t]
		const at = (t * TRAIL_CAPACITY + slot) * 3
		if (i === buffers.anchor) {
			buffers.samplesKm[at] = 0
			buffers.samplesKm[at + 1] = 0
			buffers.samplesKm[at + 2] = 0
			continue
		}
		bodyPositionAt(bodies, index, i, jd, bodyKm)
		buffers.samplesKm[at] = bodyKm[0] - anchorKm[0]
		buffers.samplesKm[at + 1] = bodyKm[1] - anchorKm[1]
		buffers.samplesKm[at + 2] = bodyKm[2] - anchorKm[2]
	}
}

/**
 * Slides the held grid range to [g0, g1] (inclusive; g1 < g0 is empty):
 * keeps what overlaps and computes only the rest. Returns true when the
 * range changed.
 */
function slide(
	buffers: TrailBuffers,
	frame: TrailFrame,
	g0: number,
	g1: number,
): boolean {
	const count = Math.max(0, g1 - g0 + 1)
	const heldFirst = buffers.first
	const heldLast = buffers.first + buffers.count - 1
	if (count === buffers.count && g0 === heldFirst) return false
	const overlaps = buffers.count > 0 && g0 <= heldLast && g1 >= heldFirst
	for (let g = g0; g <= g1; g++) {
		if (overlaps && g >= heldFirst && g <= heldLast) continue
		sample(buffers, frame, g)
	}
	buffers.first = g0
	buffers.count = count
	return true
}

/**
 * Brings the trails up to date for the frame held still on top-level body
 * `anchor` at the frame's time: slides the samples, and rewrites the vertex
 * positions (scene units, relative to the anchor's drawn position) with the
 * head on each body's current position. Returns true when the vertices
 * changed and must be uploaded. `anchor` -1 (Sun-centred) draws nothing.
 */
export function updateTrails(
	buffers: TrailBuffers,
	frame: TrailFrame,
	anchor: number,
	sinceJD: number | null,
): boolean {
	if (anchor < 0) {
		const had = buffers.vertexCount > 0
		buffers.vertexCount = 0
		buffers.count = 0
		buffers.anchor = -1
		return had
	}
	if (anchor !== buffers.anchor) {
		buffers.anchor = anchor
		buffers.count = 0
	}
	const jd = frame.jd
	const [from, to] = trailWindow(jd, sinceJD)
	const g0 = Math.ceil(from / TRAIL_STEP_DAYS)
	const g1 = Math.floor(to / TRAIL_STEP_DAYS)
	slide(buffers, frame, g0, g1)

	const headLast = jd >= to
	const count = buffers.count
	buffers.vertexCount = count + 1
	buffers.headVertex = headLast ? count : 0
	const rootRadius = frame.bodies[frame.topIndex[0]].radiusKm
	const { positionsKm } = frame
	const a = anchor * 3
	const samplesMoved =
		buffers.writtenVersion !== frame.scaleVersion ||
		buffers.writtenFirst !== buffers.first ||
		buffers.writtenCount !== count
	for (let t = 0; t < buffers.bodies.length; t++) {
		const i = buffers.bodies[t]
		const base = t * TRAIL_VERTICES
		if (samplesMoved) {
			const offset = headLast ? 0 : 1
			for (let k = 0; k < count; k++) {
				const g = buffers.first + k
				const slot = ((g % TRAIL_CAPACITY) + TRAIL_CAPACITY) % TRAIL_CAPACITY
				const s = (t * TRAIL_CAPACITY + slot) * 3
				writeVertex(
					buffers.positions,
					base + k + offset,
					buffers.samplesKm[s],
					buffers.samplesKm[s + 1],
					buffers.samplesKm[s + 2],
					rootRadius,
					frame.scale,
				)
			}
		}
		const o = i * 3
		writeVertex(
			buffers.positions,
			base + buffers.headVertex,
			positionsKm[o] - positionsKm[a],
			positionsKm[o + 1] - positionsKm[a + 1],
			positionsKm[o + 2] - positionsKm[a + 2],
			rootRadius,
			frame.scale,
		)
	}
	buffers.writtenVersion = frame.scaleVersion
	buffers.writtenFirst = buffers.first
	buffers.writtenCount = count
	return true
}

function writeVertex(
	out: Float32Array,
	vertex: number,
	x: number,
	y: number,
	z: number,
	rootRadiusKm: number,
	scale: ScaleSettings,
): void {
	framedOffset(x, y, z, rootRadiusKm, scale, drawn)
	const v = vertex * 3
	out[v] = toUnits(drawn[0])
	out[v + 1] = toUnits(drawn[1])
	out[v + 2] = toUnits(drawn[2])
}

/** Opacity of vertex `k` of `count` (0 = oldest): the tail fades out, so the direction of motion reads at a glance. */
export const trailAlpha = (
	k: number,
	count: number,
	headLast: boolean,
): number => {
	if (count <= 1) return 1
	const age = headLast ? (count - 1 - k) / (count - 1) : k / (count - 1)
	return Math.max(0, 1 - age) ** 0.6
}

/** Trail colours: each planet's own (roughly its colour in the sky), the Sun yellow. */
export const TRAIL_COLORS: Readonly<Record<string, string>> = {
	sun: "#ffd166",
	mercury: "#b8b2a7",
	venus: "#f2d38a",
	earth: "#5aa9ff",
	mars: "#ff6a3d",
	jupiter: "#e0a870",
	saturn: "#e8d596",
	uranus: "#86dbe6",
	neptune: "#6f8dff",
}
export const TRAIL_DEFAULT_COLOR = "#9aa3ad"
