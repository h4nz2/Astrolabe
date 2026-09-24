/**
 * The scale engine (#8): how true sizes and distances become what the screen shows.
 *
 * True scale is the baseline. The simulation (kepler.ts, positions.ts) always
 * works in real kilometres; a `ScaleSettings` is a set of named, deliberate
 * lies applied on top of it, and only the renderer sees the result ("display
 * space", measured in display km). There are three independent factors, each
 * a curve that is the identity at true scale:
 *
 *  - `bodySize`      every radius, compressed toward the root body's radius.
 *                    The root (the Sun) always keeps its true size: it is the
 *                    ruler everything else is drawn against.
 *  - `orbitDistance` how far bodies orbiting the root are drawn (planets, and
 *                    later dwarf planets, comets, asteroids), in root radii.
 *  - `moonDistance`  how far bodies orbiting any other body are drawn (moons,
 *                    and anything else with a non-root parent), in parent radii.
 *
 * The one rule, and the single source of truth for every derived visual: a
 * body's display position is its parent's display position plus the true
 * parent -> child offset, kept in its true direction and rescaled to
 *
 *     parentDisplayRadius * mapDistance(curve, trueDistance / parentTrueRadius)
 *
 * Orbit lines, rings, labels, moons and camera framing all derive from the
 * display positions and radii computed here, never from factors of their own,
 * so nothing can detach from its parent when the scale changes.
 *
 * Consequences:
 *  - Directions from a parent to its children are always true (which side of
 *    the Sun a planet is on, conjunctions, Kepler's second law as swept
 *    angle). Only distances and sizes lie.
 *  - Nothing is ever drawn inside its parent: every curve is the identity up to
 *    a knee of at least one parent radius and only stretches or squeezes beyond it.
 *  - Whatever orbits within `knee` parent radii (rings, ring moons) keeps its
 *    true proportion to the parent's drawn size.
 *  - Facts (distances, light travel times, sizes shown as text) always come
 *    from the true values, never from display space.
 *
 * Pure: no React, no three.js. Per-frame functions write into caller-owned
 * typed arrays and allocate nothing.
 */
import type { OrbitingBody, WritableVec3 } from "./positions"

/** How radii are drawn. */
export interface SizeCurve {
	/**
	 * Power applied to `radius / rootRadius`: 1 = true. Below 1 small bodies
	 * grow relative to big ones (0.5 turns the Sun's 109 Earth-widths into
	 * about 10). Must be > 0.
	 */
	readonly exponent: number
}

/**
 * How distances from a parent are drawn, measured in the parent's radii
 * (true radii in, drawn radii out): the identity up to `knee`, then
 * `knee * (1 + gain * ((x / knee) ** exponent - 1))`.
 */
export interface DistanceCurve {
	/** Parent radii within which distances stay proportional to the parent's drawn size; >= 1. */
	readonly knee: number
	/** Power on the distance beyond the knee (in knees): 1 = proportional, below 1 pulls far orbits in more than near ones; > 0. */
	readonly exponent: number
	/** Multiplier on the stretch beyond the knee: 1 = none, below 1 pulls everything beyond the knee toward it; > 0. */
	readonly gain: number
}

/** The three named, independent scale factors. */
export interface ScaleSettings {
	readonly bodySize: SizeCurve
	readonly orbitDistance: DistanceCurve
	readonly moonDistance: DistanceCurve
}

export type ScaleFactor = keyof ScaleSettings

/** What the scale engine needs of a body. A schema `Body` satisfies it. */
export interface ScalableBody extends OrbitingBody {
	readonly radiusKm: number
}

const deepFreeze = <T extends ScaleSettings>(scale: T): T => {
	Object.freeze(scale.bodySize)
	Object.freeze(scale.orbitDistance)
	Object.freeze(scale.moonDistance)
	return Object.freeze(scale)
}

/**
 * Named presets: the only way a scale should ever reach a user (#21 puts the
 * UI on them; a teacher never types a number). `trueScale` is the identity.
 *
 * The values are a product choice (docs/ARCHITECTURE.md, "Scale"), guarded by
 * src/sim/scale.test.ts.
 */
export const SCALE_PRESETS = {
	/** Real sizes, real distances. The planets are invisible specks; that is the lesson. */
	trueScale: deepFreeze({
		bodySize: { exponent: 1 },
		orbitDistance: { knee: 1, exponent: 1, gain: 1 },
		moonDistance: { knee: 3, exponent: 1, gain: 1 },
	}),
	/**
	 * What every diagram shows: sizes true to each other (the Sun really is
	 * 109 Earths wide), distances squeezed hard so the planets sit near it.
	 */
	textbook: deepFreeze({
		bodySize: { exponent: 1 },
		orbitDistance: { knee: 1, exponent: 0.53, gain: 0.12 },
		moonDistance: { knee: 3, exponent: 0.2, gain: 1 },
	}),
	/**
	 * The default the app opens in: small bodies enlarged, far orbits pulled
	 * in, moon systems gathered around their planets. Readable, pretty and
	 * dishonest, and to be labelled as such by #21.
	 */
	everythingVisible: deepFreeze({
		bodySize: { exponent: 0.5 },
		orbitDistance: { knee: 1, exponent: 0.52, gain: 1 },
		moonDistance: { knee: 3, exponent: 0.2, gain: 2 },
	}),
} as const satisfies Record<string, ScaleSettings>

export type ScalePresetId = keyof typeof SCALE_PRESETS

/** Preset ids in the order a UI should offer them: from the truth to the most readable lie. */
export const SCALE_PRESET_IDS: readonly ScalePresetId[] = Object.freeze([
	"trueScale",
	"textbook",
	"everythingVisible",
])

/** The preset the app opens in (a product decision, #8 / #21). */
export const DEFAULT_SCALE_PRESET: ScalePresetId = "everythingVisible"

export const TRUE_SCALE: ScaleSettings = SCALE_PRESETS.trueScale

export const isScalePresetId = (id: unknown): id is ScalePresetId =>
	typeof id === "string" && Object.hasOwn(SCALE_PRESETS, id)

/** True when the curve maps every distance to itself. */
export const isIdentityCurve = (curve: DistanceCurve): boolean =>
	curve.exponent === 1 && curve.gain === 1

/**
 * Drawn distance for a true distance, both in parent radii (true radii in,
 * drawn radii out). The identity up to the knee; monotone; never below
 * `min(x, knee)`, so a body outside its parent stays outside it.
 */
export function mapDistance(curve: DistanceCurve, x: number): number {
	const { knee } = curve
	if (!(x > knee) || isIdentityCurve(curve)) return x
	return knee * (1 + curve.gain * ((x / knee) ** curve.exponent - 1))
}

/**
 * The inverse of `mapDistance`: the true distance (parent radii) that is drawn
 * at `y` drawn parent radii. Exact, since the curve is monotone and invertible.
 */
export function unmapDistance(curve: DistanceCurve, y: number): number {
	const { knee } = curve
	if (!(y > knee) || isIdentityCurve(curve)) return y
	return knee * ((y / knee - 1) / curve.gain + 1) ** (1 / curve.exponent)
}

/** `mapDistance(curve, x) / x`: how much longer (> 1) or shorter (< 1) a distance is drawn, relative to the parent's drawn size. */
export const distanceFactor = (curve: DistanceCurve, x: number): number =>
	x > 0 ? mapDistance(curve, x) / x : 1

/** A body's drawn radius (display km). The root, whose radius is `rootRadiusKm`, keeps its true size. */
export function displayRadiusKm(
	radiusKm: number,
	rootRadiusKm: number,
	size: SizeCurve,
): number {
	if (size.exponent === 1) return radiusKm
	return rootRadiusKm * (radiusKm / rootRadiusKm) ** size.exponent
}

/**
 * A length that belongs to a body (ring radii, an atmosphere, a label's offset
 * from the centre) as drawn: it scales with the body's drawn radius, so it can
 * never detach from it. Rings sit inside `moonDistance.knee` parent radii, the
 * zone where moons keep true proportions too, so ring moons stay in their gaps.
 */
export const displayBodyLengthKm = (
	lengthKm: number,
	radiusKm: number,
	displayRadiusKm: number,
): number => lengthKm * (displayRadiusKm / radiusKm)

/** How many times larger than true a body is drawn, measured against the (true-size) root. */
export const sizeExaggeration = (
	radiusKm: number,
	rootRadiusKm: number,
	size: SizeCurve,
): number => displayRadiusKm(radiusKm, rootRadiusKm, size) / radiusKm

/**
 * The curve that places the children of a body: `orbitDistance` around the
 * root, `moonDistance` around anything else. Depth decides, never the body
 * kind, so a new kind of body (a dwarf planet, a comet, a moon of a dwarf
 * planet) needs no special case.
 */
export const childDistanceCurve = (
	scale: ScaleSettings,
	parentIsRoot: boolean,
): DistanceCurve => (parentIsRoot ? scale.orbitDistance : scale.moonDistance)

/** Drawn distance (display km) of a child at `distanceKm` (true) from its parent. */
export function displayDistanceKm(
	distanceKm: number,
	parentRadiusKm: number,
	parentDisplayRadiusKm: number,
	curve: DistanceCurve,
): number {
	return parentDisplayRadiusKm * mapDistance(curve, distanceKm / parentRadiusKm)
}

/**
 * Maps a parent-centric offset (true km) to its display offset (display km)
 * and writes it into `out[at..at + 2]`: the same direction, rescaled to
 * `displayDistanceKm(|offset|, ...)`. This is the one function every body
 * position and every orbit line vertex goes through.
 */
export function displayOffset(
	x: number,
	y: number,
	z: number,
	parentRadiusKm: number,
	parentDisplayRadiusKm: number,
	curve: DistanceCurve,
	out: WritableVec3,
	at = 0,
): void {
	const distance = Math.sqrt(x * x + y * y + z * z)
	let factor = parentDisplayRadiusKm / parentRadiusKm
	if (distance > 0) {
		const n = distance / parentRadiusKm
		factor *= mapDistance(curve, n) / n
	}
	out[at] = x * factor
	out[at + 1] = y * factor
	out[at + 2] = z * factor
}

/**
 * The inverse of `displayOffset`: the parent-centric true offset (km) that is
 * drawn at display offset (x, y, z). A point in empty space kept in true km
 * relative to an anchor body (a free camera pivot, #15) goes back to exactly
 * the same drawn place under the same scale, and follows its neighbourhood
 * when the scale changes.
 */
export function trueOffset(
	x: number,
	y: number,
	z: number,
	parentRadiusKm: number,
	parentDisplayRadiusKm: number,
	curve: DistanceCurve,
	out: WritableVec3,
	at = 0,
): void {
	const drawn = Math.sqrt(x * x + y * y + z * z)
	let factor = parentRadiusKm / parentDisplayRadiusKm
	if (drawn > 0) {
		const n = drawn / parentDisplayRadiusKm
		factor = (unmapDistance(curve, n) * parentRadiusKm) / drawn
	}
	out[at] = x * factor
	out[at + 1] = y * factor
	out[at + 2] = z * factor
}

/** Index of the root (the first body without a parent); throws when there is none. */
export function rootIndexOf(bodies: readonly ScalableBody[]): number {
	const root = bodies.findIndex((body) => body.parentId === null)
	if (root < 0) throw new Error("scale: the bodies have no root")
	return root
}

/**
 * Drawn radius (display km) of every body, in `bodies` order.
 *
 * @param out reused when given and long enough, else a new array is allocated
 */
export function computeDisplayRadii(
	bodies: readonly ScalableBody[],
	scale: ScaleSettings,
	out?: Float64Array,
): Float64Array {
	const radii =
		out !== undefined && out.length >= bodies.length
			? out
			: new Float64Array(bodies.length)
	const rootRadius = bodies[rootIndexOf(bodies)].radiusKm
	for (let i = 0; i < bodies.length; i++) {
		radii[i] = displayRadiusKm(bodies[i].radiusKm, rootRadius, scale.bodySize)
	}
	return radii
}

/**
 * Display positions (display km, scene axes) of every body from their true
 * world positions: roots stay where they are, every other body goes to its
 * parent's display position plus `displayOffset` of its true offset.
 *
 * @param bodies        topological order (every parent before its children)
 * @param truePositions written by computePositions(), 3 doubles per body
 * @param displayRadii  written by computeDisplayRadii() for the same scale
 * @param index         prebuilt buildIndex(bodies) of this same array
 * @param out           reused when given and long enough, else allocated
 * @throws Error when a parent is unknown or comes after its child
 */
export function computeDisplayPositions(
	bodies: readonly ScalableBody[],
	truePositions: Float64Array,
	displayRadii: Float64Array,
	scale: ScaleSettings,
	index: ReadonlyMap<string, number>,
	out?: Float64Array,
): Float64Array {
	const needed = bodies.length * 3
	const display =
		out !== undefined && out.length >= needed ? out : new Float64Array(needed)
	for (let i = 0; i < bodies.length; i++) {
		const body = bodies[i]
		const o = i * 3
		if (body.parentId === null) {
			display[o] = truePositions[o]
			display[o + 1] = truePositions[o + 1]
			display[o + 2] = truePositions[o + 2]
			continue
		}
		const p = index.get(body.parentId)
		if (p === undefined || p >= i) {
			throw new Error(
				`computeDisplayPositions: parent "${body.parentId}" of "${body.id}" is unknown or comes after it`,
			)
		}
		const parent = bodies[p]
		const q = p * 3
		displayOffset(
			truePositions[o] - truePositions[q],
			truePositions[o + 1] - truePositions[q + 1],
			truePositions[o + 2] - truePositions[q + 2],
			parent.radiusKm,
			displayRadii[p],
			childDistanceCurve(scale, parent.parentId === null),
			display,
			o,
		)
		display[o] += display[q]
		display[o + 1] += display[q + 1]
		display[o + 2] += display[q + 2]
	}
	return display
}

const isPositive = (value: number): boolean =>
	Number.isFinite(value) && value > 0

const isValidCurve = (curve: DistanceCurve | undefined): boolean =>
	curve !== undefined &&
	Number.isFinite(curve.knee) &&
	curve.knee >= 1 &&
	isPositive(curve.exponent) &&
	isPositive(curve.gain)

/** Every factor present, finite, exponents and gains positive, knees at least one parent radius. */
export const isValidScale = (scale: ScaleSettings | undefined): boolean =>
	scale !== undefined &&
	scale.bodySize !== undefined &&
	isPositive(scale.bodySize.exponent) &&
	isValidCurve(scale.orbitDistance) &&
	isValidCurve(scale.moonDistance)

const sameCurve = (a: DistanceCurve, b: DistanceCurve): boolean =>
	a.knee === b.knee && a.exponent === b.exponent && a.gain === b.gain

export const sameScale = (a: ScaleSettings, b: ScaleSettings): boolean =>
	a.bodySize.exponent === b.bodySize.exponent &&
	sameCurve(a.orbitDistance, b.orbitDistance) &&
	sameCurve(a.moonDistance, b.moonDistance)

/** The preset these settings are, or null for any other mix (or mid-transition). */
export const presetOf = (scale: ScaleSettings): ScalePresetId | null =>
	SCALE_PRESET_IDS.find((id) => sameScale(SCALE_PRESETS[id], scale)) ?? null

export const isTrueScale = (scale: ScaleSettings): boolean =>
	sameScale(scale, TRUE_SCALE)

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
// gains are multiplicative: blend them geometrically so a transition moves evenly
const lerpLog = (a: number, b: number, t: number): number =>
	a === b ? a : a * (b / a) ** t

const lerpCurve = (
	a: DistanceCurve,
	b: DistanceCurve,
	t: number,
): DistanceCurve => ({
	knee: lerp(a.knee, b.knee, t),
	exponent: lerp(a.exponent, b.exponent, t),
	gain: lerpLog(a.gain, b.gain, t),
})

/**
 * The scale a fraction `t` (clamped to 0..1) of the way from `from` to `to`,
 * for animated preset changes (#21): exponents and knees blend linearly,
 * gains geometrically. Returns `from` / `to` themselves at the ends, so a
 * finished transition is recognised by `presetOf`.
 */
export function interpolateScale(
	from: ScaleSettings,
	to: ScaleSettings,
	t: number,
): ScaleSettings {
	const f = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
	if (f === 0) return from
	if (f === 1) return to
	return {
		bodySize: {
			exponent: lerp(from.bodySize.exponent, to.bodySize.exponent, f),
		},
		orbitDistance: lerpCurve(from.orbitDistance, to.orbitDistance, f),
		moonDistance: lerpCurve(from.moonDistance, to.moonDistance, f),
	}
}
