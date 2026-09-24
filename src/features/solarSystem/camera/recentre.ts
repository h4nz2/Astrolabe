/**
 * Re-centring math (issue #15; docs/ARCHITECTURE.md, "Navigation"): where a
 * free pivot (a `point` view) is drawn, which body's neighbourhood it belongs
 * to, and which body a released pan lands on. Pure functions over the
 * SimFrame, no three.js objects, so every rule is unit-tested.
 *
 * A point view keeps its offset from its anchor body in TRUE km and is drawn
 * through the scale engine like anything else that is not a body
 * (`displayOffset` with the anchor as the parent): it keeps its place in the
 * anchor's neighbourhood under every scale preset, and a link carries it
 * independently of the preset.
 */
import { childDistanceCurve, displayOffset, trueOffset } from "@/sim"

import type { SimFrame } from "../scene/simFrame"

/** What the rules read from the SimFrame. */
export type RecentreFrame = Pick<
	SimFrame,
	"bodies" | "index" | "positionsKm" | "displayKm" | "displayRadiiKm" | "scale"
>

/**
 * The smallest neighbourhood a body gets, in its drawn radii: a moon without a
 * known mass, or one whose Hill sphere is drawn smaller than this, still owns
 * the space right around it.
 */
export const NEIGHBOURHOOD_MIN_RADII = 4

/**
 * A released pan re-centres on a body when the centre of the screen is on its
 * disc or within this share of the vertical field of view of it (about 11 px
 * on a 900 px tall screen, about the pick radius of a body's dot), so dragging
 * a planet to the middle is enough, while empty space a little further away
 * stays empty space.
 */
export const SNAP_FOV_FRACTION = 0.012

const scratch = new Float64Array(3)

const curveAround = (frame: RecentreFrame, anchor: number) =>
	childDistanceCurve(frame.scale, frame.bodies[anchor].parentId === null)

/**
 * Display position (display km) of a point `offsetKm` (true km) away from body
 * `anchor`: the anchor's drawn position plus the offset mapped like a child of
 * the anchor would be.
 */
export function pointDisplayKm(
	frame: RecentreFrame,
	anchor: number,
	offsetKm: ArrayLike<number>,
	out: Float64Array,
): Float64Array {
	const body = frame.bodies[anchor]
	displayOffset(
		offsetKm[0],
		offsetKm[1],
		offsetKm[2],
		body.radiusKm,
		frame.displayRadiiKm[anchor],
		curveAround(frame, anchor),
		out,
	)
	const at = anchor * 3
	out[0] += frame.displayKm[at]
	out[1] += frame.displayKm[at + 1]
	out[2] += frame.displayKm[at + 2]
	return out
}

/** The inverse of `pointDisplayKm`: the true offset from `anchor` of the drawn point `displayKm`. */
export function pointOffsetKm(
	frame: RecentreFrame,
	anchor: number,
	displayKm: ArrayLike<number>,
	out: Float64Array,
): Float64Array {
	const at = anchor * 3
	trueOffset(
		displayKm[0] - frame.displayKm[at],
		displayKm[1] - frame.displayKm[at + 1],
		displayKm[2] - frame.displayKm[at + 2],
		frame.bodies[anchor].radiusKm,
		frame.displayRadiiKm[anchor],
		curveAround(frame, anchor),
		out,
	)
	return out
}

/**
 * Radius (display km) of the space a body owns: its Hill sphere (where its
 * gravity dominates its parent's, the region its moons live in) as drawn
 * under the active scale, and never less than `NEIGHBOURHOOD_MIN_RADII` drawn
 * radii. The root owns everything.
 */
export function neighbourhoodRadiusKm(frame: RecentreFrame, i: number): number {
	const body = frame.bodies[i]
	if (body.parentId === null) return Infinity
	const drawnRadius = frame.displayRadiiKm[i]
	const floor = NEIGHBOURHOOD_MIN_RADII * drawnRadius
	const p = frame.index.get(body.parentId)
	const parent = p === undefined ? undefined : frame.bodies[p]
	if (
		p === undefined ||
		parent === undefined ||
		body.massKg === null ||
		parent.massKg === null ||
		!(body.massKg > 0) ||
		!(parent.massKg > 0)
	) {
		return floor
	}
	const at = i * 3
	const pt = p * 3
	const separation = Math.hypot(
		frame.positionsKm[at] - frame.positionsKm[pt],
		frame.positionsKm[at + 1] - frame.positionsKm[pt + 1],
		frame.positionsKm[at + 2] - frame.positionsKm[pt + 2],
	)
	const hillKm = separation * Math.cbrt(body.massKg / (3 * parent.massKg))
	displayOffset(
		hillKm,
		0,
		0,
		body.radiusKm,
		drawnRadius,
		curveAround(frame, i),
		scratch,
	)
	return Math.max(floor, scratch[0])
}

/**
 * The body whose neighbourhood the drawn point `displayKm` lies in: the
 * innermost one (a moon's inside its planet's, a planet's inside the Sun's),
 * so a pivot dropped between Jupiter's moons follows Jupiter, and one dropped
 * between the planets stays put relative to the Sun.
 */
export function neighbourhoodOf(
	frame: RecentreFrame,
	displayKm: ArrayLike<number>,
): number {
	let best = -1
	let bestRadius = Infinity
	for (let i = 0; i < frame.bodies.length; i++) {
		const radius = neighbourhoodRadiusKm(frame, i)
		const at = i * 3
		const d = Math.hypot(
			displayKm[0] - frame.displayKm[at],
			displayKm[1] - frame.displayKm[at + 1],
			displayKm[2] - frame.displayKm[at + 2],
		)
		if (best < 0 && radius === Infinity) {
			best = i
			continue
		}
		if (d <= radius && radius < bestRadius) {
			best = i
			bestRadius = radius
		}
	}
	return Math.max(best, 0)
}

/**
 * The body a released pan lands on, or -1: the centre of the screen (the ray
 * from `cameraKm` through the pivot `pivotKm`) is on the body's drawn disc or
 * within `SNAP_FOV_FRACTION` of the field of view of its centre. Of several,
 * the one closest to the ray wins (a disc the ray passes through beats one it
 * misses). Only bodies `isCandidate` accepts count (what is on screen).
 */
export function snapTarget(
	frame: RecentreFrame,
	cameraKm: ArrayLike<number>,
	pivotKm: ArrayLike<number>,
	fovDeg: number,
	isCandidate: (i: number) => boolean,
): number {
	const px = pivotKm[0] - cameraKm[0]
	const py = pivotKm[1] - cameraKm[1]
	const pz = pivotKm[2] - cameraKm[2]
	const pivotDistance = Math.hypot(px, py, pz)
	if (!(pivotDistance > 0)) return -1
	const snapAngle = (SNAP_FOV_FRACTION * fovDeg * Math.PI) / 180
	let best = -1
	let bestScore = Infinity
	for (let i = 0; i < frame.bodies.length; i++) {
		if (!isCandidate(i)) continue
		const at = i * 3
		const bx = frame.displayKm[at] - cameraKm[0]
		const by = frame.displayKm[at + 1] - cameraKm[1]
		const bz = frame.displayKm[at + 2] - cameraKm[2]
		const bodyDistance = Math.hypot(bx, by, bz)
		const radius = frame.displayRadiiKm[i]
		// behind the camera, or the camera is inside it
		if (!(bodyDistance > radius)) continue
		const cos = (bx * px + by * py + bz * pz) / (bodyDistance * pivotDistance)
		if (cos <= 0) continue
		const angle = Math.acos(Math.min(1, cos))
		const angularRadius = Math.asin(radius / bodyDistance)
		const score = angle - angularRadius
		if (score <= snapAngle && score < bestScore) {
			best = i
			bestScore = score
		}
	}
	return best
}
