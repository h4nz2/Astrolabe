/**
 * A comet's coma and tails as drawn (#23). Pure apart from the typed arrays it fills;
 * allocates nothing per frame.
 *
 * Everything starts in TRUE kilometres: the comet's true position, the true direction
 * away from the Sun (src/sim/comet.ts), the tail's true length for the comet's true
 * distance. Only then is each point of the tail drawn, with the rule a body at that place
 * would be drawn by (`mapTruePointKm`, the planets' rule plus the anchored frames of #31).
 * So the tail keeps pointing away from the drawn Sun in every preset, and at true scale it
 * is its true length: tens of millions of km behind a nucleus of a few km.
 *
 * Two tails, as real comets have:
 *  - the gas (ion) tail, straight away from the Sun, blue;
 *  - the dust tail, shorter and curved back along the orbit (the dust left behind keeps
 *    some of the comet's motion), yellowish white.
 */
import type { Body } from "@/data"
import { propagate, rootIndexOf, toUnits, type Vec3 } from "@/sim"
import { antiSunDirection, cometActivity, tailLengthKm } from "@/sim/comet"

import { mapTruePointKm, type FrontFrame } from "../light/lightFront"

/** Points along each tail. */
export const TAIL_SAMPLES = 24
/** The dust tail's length as a share of the gas tail's. */
export const DUST_TAIL_SHARE = 0.6
/** How far the dust tail's end is bent back along the orbit, as a share of its length. */
export const DUST_TAIL_BEND = 0.35
/** True radius (km) of a fully active comet's coma: the glowing cloud of gas round the nucleus. */
export const COMA_RADIUS_KM = 1e5

/** Everything about one comet's tail this frame. */
export interface TailFrame {
	/** false: asleep (beyond 4 AU) or nothing to draw */
	visible: boolean
	/** 0..1 (src/sim/comet.ts `cometActivity`) */
	activity: number
	/** true length of the gas tail (km) */
	lengthKm: number
	/** drawn radius of the coma, scene units */
	comaUnits: number
	/** render positions (scene units) of the gas tail's axis, TAIL_SAMPLES x 3 */
	ion: Float32Array
	/** render positions of the dust tail's axis */
	dust: Float32Array
	/** drawn length of the gas tail, scene units */
	ionUnits: number
}

export const createTailFrame = (): TailFrame => ({
	visible: false,
	activity: 0,
	lengthKm: 0,
	comaUnits: 0,
	ion: new Float32Array(TAIL_SAMPLES * 3),
	dust: new Float32Array(TAIL_SAMPLES * 3),
	ionUnits: 0,
})

const away = new Float64Array(3)
const motion = new Float64Array(3)
const now: Vec3 = { x: 0, y: 0, z: 0 }
const later: Vec3 = { x: 0, y: 0, z: 0 }
const drawn = new Float64Array(3)
const nucleus = new Float64Array(3)

/** Unit direction of the comet's motion around its parent at `jd`, written into `out`. */
export function motionDirection(
	orbit: NonNullable<Body["orbit"]>,
	jd: number,
	out: Float64Array,
): void {
	propagate(orbit, jd, now)
	propagate(orbit, jd + 0.01, later)
	const x = later.x - now.x
	const y = later.y - now.y
	const z = later.z - now.z
	const k = 1 / (Math.hypot(x, y, z) || 1)
	out[0] = x * k
	out[1] = y * k
	out[2] = z * k
}

/** A true point (km) drawn like a body there, then made relative to the render origin (scene units). */
function drawPoint(
	frame: FrontFrame,
	root: number,
	x: number,
	y: number,
	z: number,
	out: Float32Array,
	at: number,
): void {
	mapTruePointKm(frame, root, root, x, y, z, drawn)
	out[at] = toUnits(drawn[0] - frame.originKm[0])
	out[at + 1] = toUnits(drawn[1] - frame.originKm[1])
	out[at + 2] = toUnits(drawn[2] - frame.originKm[2])
}

/**
 * The comet at body index `i` this frame: activity, true tail length and both tails'
 * drawn axes, from the comet's and the Sun's TRUE positions.
 */
export function writeTail(
	frame: FrontFrame & { readonly jd: number },
	i: number,
	out: TailFrame,
): TailFrame {
	const body = frame.bodies[i]
	const root = rootIndexOf(frame.bodies)
	const c = i * 3
	const p = frame.positionsKm
	const distance = antiSunDirection(p, c, p, root * 3, away)
	out.activity = cometActivity(distance)
	out.lengthKm =
		body.tail === undefined || body.orbit === null
			? 0
			: tailLengthKm(body.tail, distance)
	out.visible = out.lengthKm > 0
	if (!out.visible || body.orbit === null) return out
	motionDirection(body.orbit, frame.jd, motion)

	const length = out.lengthKm
	const dustLength = DUST_TAIL_SHARE * length
	for (let k = 0; k < TAIL_SAMPLES; k++) {
		const s = k / (TAIL_SAMPLES - 1)
		const along = s * length
		drawPoint(
			frame,
			root,
			p[c] + away[0] * along,
			p[c + 1] + away[1] * along,
			p[c + 2] + away[2] * along,
			out.ion,
			k * 3,
		)
		// the dust tail: away from the Sun, bent back against the motion, more so further out
		const dustAlong = s * dustLength
		const bend = s * s * DUST_TAIL_BEND * dustLength
		drawPoint(
			frame,
			root,
			p[c] + away[0] * dustAlong - motion[0] * bend,
			p[c + 1] + away[1] * dustAlong - motion[1] * bend,
			p[c + 2] + away[2] * dustAlong - motion[2] * bend,
			out.dust,
			k * 3,
		)
	}
	const last = (TAIL_SAMPLES - 1) * 3
	out.ionUnits = Math.hypot(
		out.ion[last] - out.ion[0],
		out.ion[last + 1] - out.ion[1],
		out.ion[last + 2] - out.ion[2],
	)
	// the coma: its true radius toward the anti-Sun side, as drawn
	const coma = COMA_RADIUS_KM * out.activity
	drawPoint(
		frame,
		root,
		p[c] + away[0] * coma,
		p[c + 1] + away[1] * coma,
		p[c + 2] + away[2] * coma,
		nucleusAxis,
		0,
	)
	nucleus[0] = out.ion[0]
	nucleus[1] = out.ion[1]
	nucleus[2] = out.ion[2]
	out.comaUnits = Math.hypot(
		nucleusAxis[0] - nucleus[0],
		nucleusAxis[1] - nucleus[1],
		nucleusAxis[2] - nucleus[2],
	)
	return out
}

const nucleusAxis = new Float32Array(3)

/** Opacity along a tail at s = 0 (the nucleus) .. 1 (the end): soft start under the coma, fading out. */
export const tailAlpha = (s: number): number => {
	const start = Math.min(1, s / 0.08)
	return start * start * (1 - s) ** 1.4
}

const toCamera = new Float64Array(3)

/**
 * A camera-facing ribbon along `axis` (TAIL_SAMPLES points, scene units) into `positions`
 * (2 vertices per sample): half width `widthShare` of the drawn length at the end (a
 * quarter of that at the nucleus), never thinner than `minPx` on screen.
 */
export function writeRibbon(
	axis: Float32Array,
	lengthUnits: number,
	widthShare: number,
	minPx: number,
	camera: { x: number; y: number; z: number },
	pxPerUnitAtOne: number,
	positions: Float32Array,
	at: number,
): void {
	for (let k = 0; k < TAIL_SAMPLES; k++) {
		const s = k / (TAIL_SAMPLES - 1)
		const o = k * 3
		const prev = Math.max(0, k - 1) * 3
		const next = Math.min(TAIL_SAMPLES - 1, k + 1) * 3
		const tx = axis[next] - axis[prev]
		const ty = axis[next + 1] - axis[prev + 1]
		const tz = axis[next + 2] - axis[prev + 2]
		toCamera[0] = camera.x - axis[o]
		toCamera[1] = camera.y - axis[o + 1]
		toCamera[2] = camera.z - axis[o + 2]
		// side = tangent x toCamera
		let sx = ty * toCamera[2] - tz * toCamera[1]
		let sy = tz * toCamera[0] - tx * toCamera[2]
		let sz = tx * toCamera[1] - ty * toCamera[0]
		const sl = Math.hypot(sx, sy, sz) || 1
		const distance = Math.hypot(toCamera[0], toCamera[1], toCamera[2])
		const minHalf =
			pxPerUnitAtOne > 0 ? (0.5 * minPx * distance) / pxPerUnitAtOne : 0
		const half = Math.max(
			widthShare * lengthUnits * (0.25 + 0.75 * s),
			minHalf * (0.5 + 0.5 * s),
		)
		sx *= half / sl
		sy *= half / sl
		sz *= half / sl
		const v = at + k * 6
		positions[v] = axis[o] + sx
		positions[v + 1] = axis[o + 1] + sy
		positions[v + 2] = axis[o + 2] + sz
		positions[v + 3] = axis[o] - sx
		positions[v + 4] = axis[o + 1] - sy
		positions[v + 5] = axis[o + 2] - sz
	}
}
