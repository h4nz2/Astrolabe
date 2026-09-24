import { Body } from "astronomy-engine"
import { describe, expect, it } from "vitest"

import {
	TWO_PI,
	degToRad,
	eclipticPositionAtEccentricAnomaly,
	eclipticToScene,
	meanAnomalyAt,
	orbitalPeriodToMeanMotion,
	positionAtEccentricAnomaly,
	propagate,
	propagateEcliptic,
	radius,
	sceneToEcliptic,
	solveEccentricAnomaly,
	trueAnomaly,
	wrapAngle,
	type OrbitElements,
	type Vec3,
} from "./kepler"
import { ephemerisEclipticKm } from "./testing/ephemeris"
import { J2000_JD } from "./time"

const A = 1_000_000 // km
const P = 100 // days

/** Orbit with every angle 0 unless overridden; periapsis at the epoch. */
function orbit(overrides: Partial<OrbitElements> = {}): OrbitElements {
	return {
		semiMajorAxisKm: A,
		eccentricity: 0,
		inclinationDeg: 0,
		longAscNodeDeg: 0,
		argPeriapsisDeg: 0,
		meanAnomalyDeg: 0,
		periodDays: P,
		epochJD: J2000_JD,
		...overrides,
	}
}

const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z)

function angleBetween(a: Vec3, b: Vec3): number {
	const dot = a.x * b.x + a.y * b.y + a.z * b.z
	const cx = a.y * b.z - a.z * b.y
	const cy = a.z * b.x - a.x * b.z
	const cz = a.x * b.y - a.y * b.x
	return Math.atan2(Math.hypot(cx, cy, cz), dot)
}

/** Smallest signed difference between two angles in radians. */
const angleDiff = (a: number, b: number): number =>
	Math.abs(wrapAngle(a - b + Math.PI) - Math.PI)

describe("angles", () => {
	it("wraps into [0, 2pi)", () => {
		expect(wrapAngle(0)).toBe(0)
		expect(wrapAngle(TWO_PI)).toBe(0)
		expect(wrapAngle(-1e-18)).toBe(0)
		expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 15)
		expect(wrapAngle(7 * Math.PI)).toBeCloseTo(Math.PI, 12)
		expect(wrapAngle(1)).toBe(1)
		for (const x of [-100, -1, 0, 1, 5, 6.28, 100, 1e6]) {
			const w = wrapAngle(x)
			expect(w).toBeGreaterThanOrEqual(0)
			expect(w).toBeLessThan(TWO_PI)
		}
	})

	it("converts period to mean motion (radians per day)", () => {
		expect(orbitalPeriodToMeanMotion(365.25)).toBeCloseTo(
			degToRad(360 / 365.25),
			15,
		)
		expect(orbitalPeriodToMeanMotion(P) * P).toBeCloseTo(TWO_PI, 14)
	})

	it("computes the mean anomaly in radians, wrapped", () => {
		const o = orbit({ meanAnomalyDeg: 90 })
		expect(meanAnomalyAt(o, J2000_JD)).toBeCloseTo(Math.PI / 2, 15)
		expect(meanAnomalyAt(o, J2000_JD + P / 4)).toBeCloseTo(Math.PI, 12)
		expect(meanAnomalyAt(o, J2000_JD + P)).toBeCloseTo(Math.PI / 2, 12)
		expect(meanAnomalyAt(o, J2000_JD - P / 4)).toBeCloseTo(0, 12)
		expect(meanAnomalyAt(o, J2000_JD - 1000 * P - P / 2)).toBeCloseTo(
			(3 * Math.PI) / 2,
			9,
		)
	})
})

describe("Kepler's equation", () => {
	it("is the identity for a circular orbit", () => {
		for (let M = 0; M < TWO_PI; M += 0.1) {
			expect(solveEccentricAnomaly(M, 0)).toBe(wrapAngle(M))
			expect(trueAnomaly(M, 0)).toBeCloseTo(wrapAngle(M), 12)
		}
	})

	it.each([0.1, 0.5, 0.79, 0.8, 0.9, 0.99])(
		"converges for e = %s and satisfies M = E - e sin E to 1e-10",
		(e) => {
			const steps = 720
			for (let k = 0; k <= steps; k++) {
				const M = (TWO_PI * k) / steps
				const E = solveEccentricAnomaly(M, e)
				expect(Number.isFinite(E)).toBe(true)
				const residual = angleDiff(E - e * Math.sin(E), M)
				expect(residual).toBeLessThan(1e-10)
			}
		},
	)

	it("handles the hard corner: e = 0.99 with tiny and near-2pi mean anomalies", () => {
		for (const M of [1e-9, 1e-6, 1e-3, TWO_PI - 1e-3, TWO_PI - 1e-9]) {
			const E = solveEccentricAnomaly(M, 0.99)
			expect(angleDiff(E - 0.99 * Math.sin(E), M)).toBeLessThan(1e-10)
		}
	})

	it("accepts unwrapped mean anomalies", () => {
		const E = solveEccentricAnomaly(1 + 4 * TWO_PI, 0.3)
		expect(E).toBeCloseTo(solveEccentricAnomaly(1, 0.3), 12)
		expect(solveEccentricAnomaly(-1, 0.3)).toBeCloseTo(
			solveEccentricAnomaly(TWO_PI - 1, 0.3),
			12,
		)
	})

	it("gives the periapsis and apoapsis radii", () => {
		expect(radius(A, 0.9, 0)).toBeCloseTo(A * 0.1, 6)
		expect(radius(A, 0.9, Math.PI)).toBeCloseTo(A * 1.9, 6)
		expect(radius(A, 0, 1.234)).toBe(A)
	})

	it("puts the true anomaly in the same half as the eccentric anomaly", () => {
		for (const e of [0.1, 0.5, 0.9]) {
			expect(trueAnomaly(0, e)).toBe(0)
			expect(trueAnomaly(Math.PI, e)).toBeCloseTo(Math.PI, 12)
			expect(trueAnomaly(1, e)).toBeGreaterThan(1) // ahead of E before apoapsis
			expect(trueAnomaly(TWO_PI - 1, e)).toBeLessThan(TWO_PI - 1) // behind after
			expect(trueAnomaly(Math.acos(e), e)).toBeCloseTo(Math.PI / 2, 12) // cos E = e <=> nu = 90 deg
		}
	})
})

describe("propagation", () => {
	it("e = 0 gives uniform circular motion in the scene XZ plane", () => {
		const o = orbit()
		let previous = propagate(o, J2000_JD)
		const step = P / 37
		for (let k = 1; k <= 37; k++) {
			const current = propagate(o, J2000_JD + k * step)
			expect(length(current)).toBeCloseTo(A, 6)
			expect(current.y).toBeCloseTo(0, 6)
			// constant angular speed: every step sweeps 2pi/37
			expect(angleBetween(previous, current)).toBeCloseTo(TWO_PI / 37, 9)
			previous = current
		}
		// position is a cos(theta), -a sin(theta) with theta = 2pi t / P
		const t = 0.3 * P
		const pos = propagate(o, J2000_JD + t)
		expect(pos.x).toBeCloseTo(A * Math.cos(0.3 * TWO_PI), 6)
		expect(pos.z).toBeCloseTo(-A * Math.sin(0.3 * TWO_PI), 6)
	})

	it.each([0.9, 0.99])(
		"reaches a(1-e) at periapsis and a(1+e) at apoapsis for e = %s",
		(e) => {
			const o = orbit({ eccentricity: e })
			expect(length(propagateEcliptic(o, J2000_JD))).toBeCloseTo(A * (1 - e), 6)
			expect(length(propagateEcliptic(o, J2000_JD + P / 2))).toBeCloseTo(
				A * (1 + e),
				6,
			)
			expect(length(propagate(o, J2000_JD + 5 * P))).toBeCloseTo(A * (1 - e), 6)
		},
	)

	it.each([0, 0.3, 0.9, 0.99])(
		"closes after one period (e = %s, 1e-6 relative)",
		(e) => {
			const o = orbit({
				eccentricity: e,
				inclinationDeg: 23,
				longAscNodeDeg: 77,
				argPeriapsisDeg: 200,
				meanAnomalyDeg: 33,
			})
			for (const t of [0, 0.123 * P, 0.5 * P, 0.987 * P, 4.4 * P]) {
				const a = propagate(o, J2000_JD + t)
				const b = propagate(o, J2000_JD + t + P)
				const c = propagate(o, J2000_JD + t - 3 * P)
				expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / A).toBeLessThan(
					1e-6,
				)
				expect(Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z) / A).toBeLessThan(
					1e-6,
				)
			}
		},
	)

	it("propagate() is eclipticToScene(propagateEcliptic())", () => {
		const o = orbit({
			eccentricity: 0.4,
			inclinationDeg: 12,
			longAscNodeDeg: 100,
			argPeriapsisDeg: 250,
			meanAnomalyDeg: 10,
		})
		for (const t of [0, 17, 42.5, -300]) {
			const ecl = propagateEcliptic(o, J2000_JD + t)
			const scene = propagate(o, J2000_JD + t)
			expect(scene).toEqual(eclipticToScene(ecl))
			expect(sceneToEcliptic(scene)).toEqual(ecl)
		}
	})

	it("positionAtEccentricAnomaly agrees with propagate at the matching time", () => {
		const o = orbit({
			eccentricity: 0.6,
			inclinationDeg: 30,
			argPeriapsisDeg: 45,
		})
		const E = 2.2
		const M = E - 0.6 * Math.sin(E)
		const jd = J2000_JD + (M / TWO_PI) * P
		const byE = positionAtEccentricAnomaly(o, E)
		const byT = propagate(o, jd)
		expect(byE.x).toBeCloseTo(byT.x, 4)
		expect(byE.y).toBeCloseTo(byT.y, 4)
		expect(byE.z).toBeCloseTo(byT.z, 4)
	})

	it("reuses the `out` vector", () => {
		const out: Vec3 = { x: 1, y: 2, z: 3 }
		expect(propagate(orbit(), J2000_JD, out)).toBe(out)
		expect(out).toEqual({ x: A, y: 0, z: -0 })
	})
})

describe("frame mapping (ecliptic -> scene)", () => {
	it("maps (xe, ye, ze) to (xe, ze, -ye) and back", () => {
		expect(eclipticToScene({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 3, z: -2 })
		expect(sceneToEcliptic({ x: 1, y: 3, z: -2 })).toEqual({ x: 1, y: 2, z: 3 })
		// the north ecliptic pole is scene +Y
		expect(eclipticToScene({ x: 0, y: 0, z: 1 })).toEqual({ x: 0, y: 1, z: -0 })
	})

	it("keeps an orbit with i = 0 in the scene XZ plane (y = 0)", () => {
		const o = orbit({
			eccentricity: 0.5,
			longAscNodeDeg: 123,
			argPeriapsisDeg: 45,
			meanAnomalyDeg: 10,
		})
		for (let t = 0; t < P; t += P / 50) {
			expect(Math.abs(propagate(o, J2000_JD + t).y)).toBeLessThan(1e-9 * A)
		}
	})

	it("i = 90, Omega = 0: node along +X, max scene Y (north) at true anomaly 90", () => {
		for (const e of [0, 0.3]) {
			const o = orbit({ eccentricity: e, inclinationDeg: 90 })
			// ascending node = periapsis here (omega = 0): the body is on +X
			const node = propagate(o, J2000_JD)
			expect(node.x).toBeCloseTo(A * (1 - e), 6)
			expect(node.y).toBeCloseTo(0, 6)
			expect(node.z).toBeCloseTo(0, 6)
			// true anomaly 90 deg <=> cos E = e; there the body is straight north
			const E = Math.acos(e)
			const north = positionAtEccentricAnomaly(o, E)
			const r = A * (1 - e * e) // a(1-e^2)/(1+e cos 90)
			expect(north.x).toBeCloseTo(0, 6)
			expect(north.y).toBeCloseTo(r, 6)
			expect(north.z).toBeCloseTo(0, 6)
			if (e === 0) {
				// for a circle that is also the highest point of the whole revolution
				let maxY = -Infinity
				for (let k = 0; k < 720; k++) {
					maxY = Math.max(
						maxY,
						positionAtEccentricAnomaly(o, (TWO_PI * k) / 720).y,
					)
				}
				expect(maxY).toBeLessThanOrEqual(north.y + 1e-6)
				// and it is reached a quarter period after the node, via time
				const q = propagate(o, J2000_JD + P / 4)
				expect(q.y).toBeCloseTo(A, 6)
			}
		}
	})

	it("is right handed: prograde motion is counterclockwise seen from scene +Y", () => {
		const o = orbit({ eccentricity: 0.1 })
		const ecl = propagateEcliptic(o, J2000_JD + 0.01 * P)
		const scene = propagate(o, J2000_JD + 0.01 * P)
		expect(ecl.y).toBeGreaterThan(0) // ye grows after periapsis
		expect(scene.x).toBeGreaterThan(0)
		expect(scene.z).toBeLessThan(0) // scene Z = -ye
		expect(scene.z).toBeCloseTo(-ecl.y, 9)
	})

	it("an inclined prograde orbit rises north (scene +Y) after the ascending node", () => {
		const o = orbit({
			inclinationDeg: 30,
			longAscNodeDeg: 60,
			argPeriapsisDeg: 0,
		})
		const justAfterNode = propagate(o, J2000_JD + 0.02 * P)
		expect(justAfterNode.y).toBeGreaterThan(0)
		const ecl = propagateEcliptic(o, J2000_JD)
		// at the node with Omega = 60 deg the ecliptic direction is (cos 60, sin 60, 0)
		expect(Math.atan2(ecl.y, ecl.x)).toBeCloseTo(degToRad(60), 9)
		expect(ecl.z).toBeCloseTo(0, 6)
	})

	it("eclipticPositionAtEccentricAnomaly rotates by omega, i, Omega in that order", () => {
		// omega = 90: periapsis is 90 deg past the node in the orbital plane,
		// so with i = 90, Omega = 0 the periapsis points straight north.
		const o = orbit({ inclinationDeg: 90, argPeriapsisDeg: 90 })
		const p = eclipticPositionAtEccentricAnomaly(o, 0)
		expect(p.x).toBeCloseTo(0, 6)
		expect(p.y).toBeCloseTo(0, 6)
		expect(p.z).toBeCloseTo(A, 6)
		// Omega = 90, i = 0: the ellipse is rotated by 90 deg in the ecliptic plane
		const q = eclipticPositionAtEccentricAnomaly(
			orbit({ longAscNodeDeg: 90 }),
			0,
		)
		expect(q.x).toBeCloseTo(0, 6)
		expect(q.y).toBeCloseTo(A, 6)
	})
})

// --- Validation against astronomy-engine (VSOP87-based ephemeris) ------------

interface PlanetCase {
	name: string
	body: Body
	a: number
	e: number
	i: number
	node: number
	peri: number
	m0: number
	period: number
	maxSeparationDeg: number
}

// A hand-written table of J2000 osculating elements: a (km), e, i, Omega, omega, M0 (deg),
// period (days). It exercises the propagator itself; the emitted bodies.json elements are
// checked against the ephemeris in positions.test.ts.
const PLANETS: PlanetCase[] = [
	{
		name: "Mercury",
		body: Body.Mercury,
		a: 57909050,
		e: 0.2056,
		i: 7.005,
		node: 48.331,
		peri: 29.124,
		m0: 174.796,
		period: 87.969,
		maxSeparationDeg: 1.5,
	},
	{
		name: "Venus",
		body: Body.Venus,
		a: 108208000,
		e: 0.0067,
		i: 3.395,
		node: 76.68,
		peri: 54.884,
		m0: 50.115,
		period: 224.701,
		maxSeparationDeg: 1.5,
	},
	{
		name: "Earth",
		body: Body.Earth,
		a: 149598023,
		e: 0.0167,
		i: 0.0,
		node: -11.261,
		peri: 114.208,
		m0: 358.617,
		period: 365.256,
		maxSeparationDeg: 1.5,
	},
	{
		name: "Mars",
		body: Body.Mars,
		a: 227939200,
		e: 0.0934,
		i: 1.85,
		node: 49.558,
		peri: 286.502,
		m0: 19.373,
		period: 686.98,
		maxSeparationDeg: 1.5,
	},
	{
		name: "Jupiter",
		body: Body.Jupiter,
		a: 778570000,
		e: 0.0489,
		i: 1.303,
		node: 100.464,
		peri: 273.867,
		m0: 20.02,
		period: 4332.59,
		maxSeparationDeg: 2,
	},
	{
		name: "Saturn",
		body: Body.Saturn,
		a: 1433530000,
		e: 0.0565,
		i: 2.485,
		node: 113.665,
		peri: 339.392,
		m0: 317.02,
		period: 10759.22,
		maxSeparationDeg: 2,
	},
	{
		name: "Uranus",
		body: Body.Uranus,
		a: 2875040000,
		e: 0.0457,
		i: 0.773,
		node: 74.006,
		peri: 96.999,
		m0: 142.239,
		period: 30688.5,
		maxSeparationDeg: 2,
	},
	{
		name: "Neptune",
		body: Body.Neptune,
		a: 4500000000,
		e: 0.0113,
		i: 1.77,
		node: 131.784,
		peri: 276.336,
		m0: 256.228,
		period: 60182,
		maxSeparationDeg: 2,
	},
]

const toOrbit = (p: PlanetCase): OrbitElements => ({
	semiMajorAxisKm: p.a,
	eccentricity: p.e,
	inclinationDeg: p.i,
	longAscNodeDeg: p.node,
	argPeriapsisDeg: p.peri,
	meanAnomalyDeg: p.m0,
	periodDays: p.period,
	epochJD: J2000_JD,
})

const SAMPLE_OFFSETS_DAYS = [0, 1000, -2000]

describe("validation against astronomy-engine", () => {
	it.each(PLANETS)(
		"$name: direction within $maxSeparationDeg deg and distance within 3 % at J2000, +1000 d, -2000 d",
		(planet) => {
			const o = toOrbit(planet)
			for (const dt of SAMPLE_OFFSETS_DAYS) {
				const jd = J2000_JD + dt
				const ours = propagateEcliptic(o, jd)
				const reference = ephemerisEclipticKm(planet.body, jd)
				const separationDeg = angleBetween(ours, reference) * (180 / Math.PI)
				const ratio = length(ours) / length(reference)
				expect(
					separationDeg,
					`${planet.name} at J2000${dt >= 0 ? "+" : ""}${dt} d: separation ${separationDeg.toFixed(3)} deg`,
				).toBeLessThan(planet.maxSeparationDeg)
				expect(
					Math.abs(ratio - 1),
					`${planet.name} at J2000${dt >= 0 ? "+" : ""}${dt} d: distance ratio ${ratio.toFixed(4)}`,
				).toBeLessThan(0.03)
			}
		},
	)

	it("the ephemeris helper itself is in the ecliptic frame (Earth has ~0 latitude)", () => {
		for (const dt of SAMPLE_OFFSETS_DAYS) {
			const earth = ephemerisEclipticKm(Body.Earth, J2000_JD + dt)
			const latitudeDeg = Math.asin(earth.z / length(earth)) * (180 / Math.PI)
			expect(Math.abs(latitudeDeg)).toBeLessThan(0.01)
		}
	})
})
