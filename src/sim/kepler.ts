/**
 * Keplerian two-body propagation and the ecliptic -> scene frame mapping.
 *
 * Frame contract (owned by this module, see docs/ARCHITECTURE.md):
 *
 *   Ecliptic frame (right handed, J2000): xe points at the vernal equinox,
 *   ze at the north ecliptic pole, ye = ze x xe (so the ecliptic plane is xe-ye).
 *   Scene frame (three.js, Y-up):        (X, Y, Z) = (xe, ze, -ye)
 *
 * Consequences: the ecliptic plane is the scene XZ plane, scene +Y is ecliptic
 * north, and a prograde orbit runs counterclockwise when viewed from +Y.
 * Both frames are right handed, so the mapping is a pure rotation.
 *
 * Angle conventions: orbital elements carry degrees (as in the data); every
 * bare angle a function here takes or returns is in radians.
 * All arithmetic is in doubles (plain JS numbers). No three.js, no React.
 */
import type { Orbit } from "@/data/schema"

/**
 * The orbital elements propagation needs: the schema `Orbit` from "@/data"
 * without its bookkeeping flag `phaseSynthetic`. A `Body["orbit"]` from
 * bodies.json is therefore accepted as is (type-only import, no runtime
 * dependency on the data layer).
 */
export type OrbitElements = Readonly<Omit<Orbit, "phaseSynthetic">>

/** A mutable xyz triple. three.js `Vector3` satisfies it structurally. */
export interface Vec3 {
	x: number
	y: number
	z: number
}

export const TWO_PI = 2 * Math.PI
export const DEG_TO_RAD = Math.PI / 180
export const RAD_TO_DEG = 180 / Math.PI

export const degToRad = (deg: number): number => deg * DEG_TO_RAD
export const radToDeg = (rad: number): number => rad * RAD_TO_DEG

/** Wraps an angle in radians into [0, 2pi). */
export function wrapAngle(rad: number): number {
	const r = rad % TWO_PI
	const wrapped = r < 0 ? r + TWO_PI : r
	// r + TWO_PI can round to exactly TWO_PI for tiny negative r
	return wrapped === TWO_PI ? 0 : wrapped
}

/** Mean motion n in radians per day for a sidereal period in days. */
export function orbitalPeriodToMeanMotion(periodDays: number): number {
	return TWO_PI / periodDays
}

/**
 * Mean anomaly in radians at `jd`, wrapped to [0, 2pi):
 * M = M0 + n (jd - epoch), n = 2pi / P.
 */
export function meanAnomalyAt(orbit: OrbitElements, jd: number): number {
	const m0 = degToRad(orbit.meanAnomalyDeg)
	const n = orbitalPeriodToMeanMotion(orbit.periodDays)
	return wrapAngle(m0 + n * (jd - orbit.epochJD))
}

/** Convergence threshold on the Newton step |dE| in radians. */
export const KEPLER_TOLERANCE = 1e-12
/** Upper bound on Newton iterations; 0 <= e <= 0.99 converges in well under 20. */
export const KEPLER_MAX_ITERATIONS = 50

/**
 * Solves Kepler's equation M = E - e sin E for the eccentric anomaly E (radians)
 * with Newton's method.
 *
 * Start value: E0 = M for e < 0.8, else E0 = pi. Starting at pi guarantees
 * monotone convergence for high eccentricities (f is convex on [0, pi] and
 * concave on [pi, 2pi], and the root lies between pi and M on both halves).
 * Stops when |dE| < KEPLER_TOLERANCE or after KEPLER_MAX_ITERATIONS and
 * returns the last estimate; it never throws. Elliptic orbits only (0 <= e < 1).
 *
 * @param meanAnomaly M in radians (any value, wrapped internally)
 * @param eccentricity e in [0, 1)
 * @returns E in [0, 2pi]
 */
export function solveEccentricAnomaly(
	meanAnomaly: number,
	eccentricity: number,
): number {
	const m = wrapAngle(meanAnomaly)
	const e = eccentricity
	if (e === 0) return m
	let E = e < 0.8 ? m : Math.PI
	for (let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
		const f = E - e * Math.sin(E) - m
		const fPrime = 1 - e * Math.cos(E)
		const dE = f / fPrime
		E -= dE
		if (Math.abs(dE) < KEPLER_TOLERANCE) break
	}
	return E
}

/**
 * True anomaly nu (radians, [0, 2pi)) from the eccentric anomaly:
 * tan(nu/2) = sqrt((1+e)/(1-e)) tan(E/2), evaluated with atan2 so every quadrant works.
 */
export function trueAnomaly(
	eccentricAnomaly: number,
	eccentricity: number,
): number {
	const halfE = eccentricAnomaly / 2
	return wrapAngle(
		2 *
			Math.atan2(
				Math.sqrt(1 + eccentricity) * Math.sin(halfE),
				Math.sqrt(1 - eccentricity) * Math.cos(halfE),
			),
	)
}

/**
 * Distance from the focus (km) at eccentric anomaly E: r = a (1 - e cos E).
 * Exact at periapsis (E = 0, r = a(1-e)) and apoapsis (E = pi, r = a(1+e)).
 */
export function radius(
	semiMajorAxisKm: number,
	eccentricity: number,
	eccentricAnomaly: number,
): number {
	return semiMajorAxisKm * (1 - eccentricity * Math.cos(eccentricAnomaly))
}

/** Maps an ecliptic-frame vector to the scene frame: (xe, ye, ze) -> (xe, ze, -ye). */
export function eclipticToScene(
	v: Vec3,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	const { x, y, z } = v
	out.x = x
	out.y = z
	out.z = -y
	return out
}

/** Inverse of eclipticToScene(): (X, Y, Z) -> (X, -Z, Y). */
export function sceneToEcliptic(
	v: Vec3,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	const { x, y, z } = v
	out.x = x
	out.y = -z
	out.z = y
	return out
}

/**
 * Parent-centric position (km) in the ECLIPTIC frame at eccentric anomaly E.
 *
 * Standard perifocal -> ecliptic rotation R3(-Omega) R1(-i) R3(-omega) applied
 * to the perifocal vector (r cos nu, r sin nu, 0), written with the argument of
 * latitude u = omega + nu:
 *   xe = r (cos Omega cos u - sin Omega sin u cos i)
 *   ye = r (sin Omega cos u + cos Omega sin u cos i)
 *   ze = r  sin u sin i
 * Useful on its own for sampling orbit lines at uniform E.
 */
export function eclipticPositionAtEccentricAnomaly(
	orbit: OrbitElements,
	eccentricAnomaly: number,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	const e = orbit.eccentricity
	const r = radius(orbit.semiMajorAxisKm, e, eccentricAnomaly)
	const nu = trueAnomaly(eccentricAnomaly, e)
	const u = degToRad(orbit.argPeriapsisDeg) + nu
	const inc = degToRad(orbit.inclinationDeg)
	const node = degToRad(orbit.longAscNodeDeg)
	const cosU = Math.cos(u)
	const sinU = Math.sin(u)
	const cosI = Math.cos(inc)
	const sinI = Math.sin(inc)
	const cosO = Math.cos(node)
	const sinO = Math.sin(node)
	out.x = r * (cosO * cosU - sinO * sinU * cosI)
	out.y = r * (sinO * cosU + cosO * sinU * cosI)
	out.z = r * (sinU * sinI)
	return out
}

/** Parent-centric position (km) in the SCENE frame at eccentric anomaly E. */
export function positionAtEccentricAnomaly(
	orbit: OrbitElements,
	eccentricAnomaly: number,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	eclipticPositionAtEccentricAnomaly(orbit, eccentricAnomaly, out)
	return eclipticToScene(out, out)
}

/**
 * Parent-centric position (km) in the ECLIPTIC frame at Julian Date `jd`.
 * Exposed for tests and for anything that wants to compare with ephemerides.
 */
export function propagateEcliptic(
	orbit: OrbitElements,
	jd: number,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	const M = meanAnomalyAt(orbit, jd)
	const E = solveEccentricAnomaly(M, orbit.eccentricity)
	return eclipticPositionAtEccentricAnomaly(orbit, E, out)
}

/**
 * Parent-centric position (km) in the SCENE frame (three.js Y-up) at Julian
 * Date `jd`. This is what the renderer and computePositions() use.
 * Pass `out` to avoid allocating in per-frame code.
 */
export function propagate(
	orbit: OrbitElements,
	jd: number,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	propagateEcliptic(orbit, jd, out)
	return eclipticToScene(out, out)
}
