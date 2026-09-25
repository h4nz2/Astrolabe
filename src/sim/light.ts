/**
 * Light travel (#27): how long light and radio signals take between bodies.
 *
 * Every number here comes from TRUE positions (km), never from display space:
 * the scale presets lie about distances, light travel times must not.
 *
 * A light pulse is a sphere that grows at the speed of light around the point
 * where its source was at the moment it was sent. That point stays fixed in
 * the Sun-centred frame (light does not ride along with the planet that sent
 * it), while the targets keep moving: a pulse reaches a body when the sphere's
 * radius equals the body's distance from that fixed point AT THAT MOMENT.
 * `arrivalJD` solves exactly that, so arrival times are correct for where the
 * bodies are, not where they were.
 *
 * Pure: no React, no three.js.
 */
import { propagate, type Vec3 } from "./kepler"
import type { OrbitingBody } from "./positions"
import { SECONDS_PER_DAY } from "./units"

/** The speed of light in vacuum, km/s (exact by the definition of the metre). */
export const SPEED_OF_LIGHT_KM_S = 299_792.458

/** One light-year in km (Julian year of 365.25 days). */
export const LIGHT_YEAR_KM = SPEED_OF_LIGHT_KM_S * 365.25 * SECONDS_PER_DAY

/** Seconds light needs for `km`. */
export const lightSeconds = (km: number): number => km / SPEED_OF_LIGHT_KM_S

/** Km light covers in `seconds`. */
export const lightDistanceKm = (seconds: number): number =>
	seconds * SPEED_OF_LIGHT_KM_S

/**
 * Seconds a pulse sent at `emitJD` has been travelling at `jd` (simulation
 * time, so it follows pause, speed and reverse). Negative before it was sent.
 */
export const secondsSince = (emitJD: number, jd: number): number =>
	(jd - emitJD) * SECONDS_PER_DAY

/** Radius (km) of the light sphere sent at `emitJD`, at `jd`; 0 before it was sent. */
export const frontRadiusKm = (emitJD: number, jd: number): number =>
	Math.max(0, lightDistanceKm(secondsSince(emitJD, jd)))

const scratch: Vec3 = { x: 0, y: 0, z: 0 }

/**
 * TRUE world position (km, scene axes, Sun-centred) of body `i` alone at
 * `jd`: the sum of the orbits up its parent chain. Cheaper than computing
 * every body when only a few are needed at other times than the frame's.
 */
export function truePositionAt(
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
			propagate(body.orbit, jd, scratch)
			x += scratch.x
			y += scratch.y
			z += scratch.z
		}
		j = body.parentId === null ? undefined : index.get(body.parentId)
	}
	out[at] = x
	out[at + 1] = y
	out[at + 2] = z
	return out
}

const target = new Float64Array(3)

/**
 * When (JD) light sent from `origin` (true km, Sun-centred) at `emitJD`
 * reaches body `i`: the solution of |pos_i(t) - origin| = c (t - emitJD).
 * Fixed-point iteration; it contracts by v/c (about 1e-4 for a planet), so a
 * few rounds are exact to far below a millisecond.
 */
export function arrivalJD(
	bodies: readonly OrbitingBody[],
	index: ReadonlyMap<string, number>,
	i: number,
	origin: ArrayLike<number>,
	emitJD: number,
): number {
	let jd = emitJD
	for (let round = 0; round < 6; round++) {
		truePositionAt(bodies, index, i, jd, target)
		const distance = Math.hypot(
			target[0] - origin[0],
			target[1] - origin[1],
			target[2] - origin[2],
		)
		const next = emitJD + lightSeconds(distance) / SECONDS_PER_DAY
		if (Math.abs(next - jd) * SECONDS_PER_DAY < 1e-6) return next
		jd = next
	}
	return jd
}

/** Distance (km) between bodies `a` and `b` at `jd`, from true positions. */
export function distanceBetweenKm(
	bodies: readonly OrbitingBody[],
	index: ReadonlyMap<string, number>,
	a: number,
	b: number,
	jd: number,
): number {
	const pa = truePositionAt(bodies, index, a, jd, new Float64Array(3))
	const pb = truePositionAt(bodies, index, b, jd, target)
	return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
}

/** What `neighbourhoodRadiusKm` and `distanceRangeKm` need of a body. */
export interface LightBody extends OrbitingBody {
	readonly radiusKm: number
	readonly massKg: number | null
}

/**
 * The true radius (km) of a body's own neighbourhood, where its moons live:
 * its Hill sphere, a(1 - e) (m / 3M)^(1/3) with M its parent's mass, and never
 * less than 4 radii. The Sun's neighbourhood is everything (Infinity).
 */
export function neighbourhoodRadiusKm(
	body: LightBody,
	parent: LightBody | undefined,
): number {
	if (body.orbit === null || parent === undefined) return Infinity
	const mass = body.massKg ?? 0
	const parentMass = parent.massKg ?? 0
	const hill =
		parentMass > 0 && mass > 0
			? body.orbit.semiMajorAxisKm *
				(1 - body.orbit.eccentricity) *
				Math.cbrt(mass / (3 * parentMass))
			: 0
	return Math.max(hill, 4 * body.radiusKm)
}

const periapsis = (body: OrbitingBody): number =>
	body.orbit === null
		? 0
		: body.orbit.semiMajorAxisKm * (1 - body.orbit.eccentricity)
const apoapsis = (body: OrbitingBody): number =>
	body.orbit === null
		? 0
		: body.orbit.semiMajorAxisKm * (1 + body.orbit.eccentricity)

/**
 * The smallest and largest distance (km) between `from` and `to` over all
 * positions on their orbits, ignoring inclinations: what a signal delay
 * ranges between "depending on where both are" (Mars from Earth: about 3 to
 * 22 light-minutes). Handles a body and its parent or child (the Sun and a
 * planet, a planet and its moon) and two bodies orbiting the same parent;
 * for anything else (a moon of another planet) the parents' range stands in.
 */
export function distanceRangeKm(
	from: OrbitingBody,
	to: OrbitingBody,
	byId: ReadonlyMap<string, OrbitingBody>,
): { min: number; max: number } {
	if (to.parentId === from.id) return { min: periapsis(to), max: apoapsis(to) }
	if (from.parentId === to.id) {
		return { min: periapsis(from), max: apoapsis(from) }
	}
	if (from.parentId !== null && from.parentId === to.parentId) {
		const [inner, outer] =
			apoapsis(from) <= apoapsis(to) ? [from, to] : [to, from]
		return {
			min: Math.max(0, periapsis(outer) - apoapsis(inner)),
			max: apoapsis(inner) + apoapsis(outer),
		}
	}
	// a moon of another planet: its planet's range, widened by the moon's orbit
	const toParent = to.parentId === null ? undefined : byId.get(to.parentId)
	if (toParent !== undefined && toParent.parentId !== null) {
		const range = distanceRangeKm(from, toParent, byId)
		return {
			min: Math.max(0, range.min - apoapsis(to)),
			max: range.max + apoapsis(to),
		}
	}
	const fromParent =
		from.parentId === null ? undefined : byId.get(from.parentId)
	if (fromParent !== undefined && fromParent.parentId !== null) {
		const range = distanceRangeKm(fromParent, to, byId)
		return {
			min: Math.max(0, range.min - apoapsis(from)),
			max: range.max + apoapsis(from),
		}
	}
	return { min: 0, max: 0 }
}
