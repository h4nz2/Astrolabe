/**
 * Anchored reference frames (#31): drawing the solar system as seen from a
 * body that is held still, instead of from the Sun.
 *
 * The frames are not rotating: their axes stay fixed to the stars (the scene
 * axes), exactly as the sky is. Held still on Earth, Mars stops tracing an
 * ellipse and draws a loop every two years; that loop is the retrograde motion
 * of the sky, and it only exists in this frame.
 *
 * The scale engine (scale.ts) draws the planets around the Sun: the direction
 * from the Sun to a planet is true, the distance squeezed by `orbitDistance`.
 * The direction from one planet to ANOTHER is then not true (docs/ARCHITECTURE.md,
 * "Scale"), which would bend the very loop this frame is about. So an anchored
 * frame re-roots the one rule at the anchor's planet ("top-level" body, the
 * child of the root it belongs to): the anchor planet stays where it is drawn,
 * and every other top-level body (the Sun included) is drawn at
 *
 *     anchorPlanet + displayOffset(true(body) - true(anchorPlanet))
 *
 * with the same `orbitDistance` curve in root radii. Every direction seen from
 * the anchor planet is then its true direction in the sky, in every preset,
 * and at true scale nothing changes at all (the curve is the identity). The
 * Sun lands exactly where it was (same distance, reversed direction), and
 * moons ride along with their planet, so nothing is ever a second model.
 *
 * Pure: no React, no three.js. Per-frame functions write into caller-owned
 * typed arrays and allocate nothing.
 */
import { propagate, type Vec3 } from "./kepler"
import type { OrbitingBody } from "./positions"
import { displayOffset, type ScalableBody, type ScaleSettings } from "./scale"

/**
 * Index of the top-level body of every body: the root's child it belongs to
 * (a planet for its moons, the planet itself), and the root for the root.
 *
 * @param bodies topological order (every parent before its children)
 */
export function topLevelIndices(
	bodies: readonly OrbitingBody[],
	index: ReadonlyMap<string, number>,
): Int32Array {
	const top = new Int32Array(bodies.length)
	for (let i = 0; i < bodies.length; i++) {
		const parentId = bodies[i].parentId
		if (parentId === null) {
			top[i] = i
			continue
		}
		const p = index.get(parentId)
		if (p === undefined || p >= i) {
			throw new Error(
				`topLevelIndices: parent "${parentId}" of "${bodies[i].id}" is unknown or comes after it`,
			)
		}
		top[i] = bodies[p].parentId === null ? i : top[p]
	}
	return top
}

/**
 * Drawn offset (display km) between two top-level bodies `dx, dy, dz` (true
 * km) apart, in an anchored frame: the root's `orbitDistance` curve, in root
 * radii (the root keeps its true size in every scale, scale.ts).
 */
export function framedOffset(
	dx: number,
	dy: number,
	dz: number,
	rootRadiusKm: number,
	scale: ScaleSettings,
	out: Float64Array,
	at = 0,
): void {
	displayOffset(
		dx,
		dy,
		dz,
		rootRadiusKm,
		rootRadiusKm,
		scale.orbitDistance,
		out,
		at,
	)
}

/** The blend of anchored frames `applyReferenceFrame` draws: up to a few anchors and their weights. */
export interface FrameBlend {
	/** Top-level body index per slot (the root: no anchor). */
	readonly anchors: Int32Array
	/** Weight per slot, 0..1 (their sum is at most 1; the rest is Sun-centred). */
	readonly weights: Float64Array
}

/**
 * Re-draws `display` (heliocentric display positions from
 * `computeDisplayPositions`, modified in place) in the blend of anchored
 * frames: each top-level body moves by the weighted difference between where
 * each anchor's frame and the Sun-centred frame draw it, and its moons move
 * with it. The root and the anchors themselves never move; with no weight
 * nothing changes.
 *
 * @param top     from `topLevelIndices` of the same bodies
 * @param scratch at least 3 doubles per body
 */
export function applyReferenceFrame(
	bodies: readonly ScalableBody[],
	truePositions: Float64Array,
	display: Float64Array,
	scale: ScaleSettings,
	top: Int32Array,
	blend: FrameBlend,
	scratch: Float64Array,
): void {
	const n = bodies.length
	let any = false
	for (let k = 0; k < blend.weights.length; k++) {
		if (blend.weights[k] > 0 && bodies[blend.anchors[k]].parentId !== null) {
			any = true
		}
	}
	if (!any) return
	let root = 0
	for (let i = 0; i < n; i++) {
		if (bodies[i].parentId === null) root = i
		scratch[i * 3] = 0
		scratch[i * 3 + 1] = 0
		scratch[i * 3 + 2] = 0
	}
	const rootRadius = bodies[root].radiusKm
	const moved = scratch
	// the shift of every top-level body, from the untouched heliocentric positions
	for (let k = 0; k < blend.weights.length; k++) {
		const w = blend.weights[k]
		const a = blend.anchors[k]
		if (!(w > 0) || bodies[a].parentId === null) continue
		const at = a * 3
		for (let i = 0; i < n; i++) {
			if (top[i] !== i || i === a || i === root) continue
			const o = i * 3
			framedOffset(
				truePositions[o] - truePositions[at],
				truePositions[o + 1] - truePositions[at + 1],
				truePositions[o + 2] - truePositions[at + 2],
				rootRadius,
				scale,
				framedScratch,
			)
			moved[o] += w * (display[at] + framedScratch[0] - display[o])
			moved[o + 1] += w * (display[at + 1] + framedScratch[1] - display[o + 1])
			moved[o + 2] += w * (display[at + 2] + framedScratch[2] - display[o + 2])
		}
	}
	// moons follow their planet; top-level bodies apply their own shift
	for (let i = 0; i < n; i++) {
		const o = i * 3
		const t = top[i] * 3
		display[o] += moved[t]
		display[o + 1] += moved[t + 1]
		display[o + 2] += moved[t + 2]
	}
}

const framedScratch = new Float64Array(3)
const propagated: Vec3 = { x: 0, y: 0, z: 0 }

/**
 * TRUE world position (km, scene axes) of body `i` alone at `jd`: the sum of
 * the orbits up its parent chain. For per-body sampling in the past or future
 * (trails, the HUD) without computing every body.
 */
export function bodyPositionAt(
	bodies: readonly OrbitingBody[],
	index: ReadonlyMap<string, number>,
	i: number,
	jd: number,
	out: Float64Array,
	at = 0,
): Float64Array {
	let x = 0
	let y = 0
	let z = 0
	let j: number | undefined = i
	while (j !== undefined) {
		const body: OrbitingBody = bodies[j]
		if (body.orbit !== null) {
			propagate(body.orbit, jd, propagated)
			x += propagated.x
			y += propagated.y
			z += propagated.z
		}
		j = body.parentId === null ? undefined : index.get(body.parentId)
	}
	out[at] = x
	out[at + 1] = y
	out[at + 2] = z
	return out
}
