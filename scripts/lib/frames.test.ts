import { describe, expect, it } from "vitest"

import {
	eclipticPositionAtEccentricAnomaly,
	trueAnomaly,
	type OrbitElements,
	type Vec3,
} from "../../src/sim/kepler"
import { eclipticDirection } from "../../src/sim/rotation"

import {
	apply,
	elementsFromOrientation,
	equatorToEcliptic,
	multiply,
	orbitOrientation,
	rotX,
	rotZ,
	rotateElementsToEcliptic,
	type Mat3,
	type PlaneElements,
} from "./frames"

const DEG = Math.PI / 180

const angleDeg = (a: Vec3, b: Vec3): number => {
	const dot = a.x * b.x + a.y * b.y + a.z * b.z
	const norm = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)
	return Math.acos(Math.min(1, Math.max(-1, dot / norm))) / DEG
}

/** Orbit normal h = (sin i sin Omega, -sin i cos Omega, cos i). */
const normalOf = (el: PlaneElements): Vec3 => {
	const i = el.inclinationDeg * DEG
	const node = el.longAscNodeDeg * DEG
	return {
		x: Math.sin(i) * Math.sin(node),
		y: -Math.sin(i) * Math.cos(node),
		z: Math.cos(i),
	}
}

const expectVec = (actual: Vec3, expected: Vec3, digits = 9): void => {
	expect(actual.x).toBeCloseTo(expected.x, digits)
	expect(actual.y).toBeCloseTo(expected.y, digits)
	expect(actual.z).toBeCloseTo(expected.z, digits)
}

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const ECLIPTIC_POLE: Vec3 = { x: 0, y: 0, z: 1 }
const SATURN_POLE = eclipticDirection(40.589, 83.537)
const URANUS_POLE = eclipticDirection(257.311, -15.175)

describe("3x3 rotations", () => {
	it("rotX and rotZ are active right-handed rotations", () => {
		expectVec(apply(rotZ(90 * DEG), { x: 1, y: 0, z: 0 }), { x: 0, y: 1, z: 0 })
		expectVec(apply(rotX(90 * DEG), { x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 1 })
	})

	it("multiply composes (right operand first) and has an identity", () => {
		const a = rotZ(0.4)
		const b = rotX(1.1)
		const v: Vec3 = { x: 0.3, y: -0.7, z: 0.2 }
		expectVec(apply(multiply(a, b), v), apply(a, apply(b, v)))
		expect(multiply(IDENTITY, a)).toEqual(a)
		expectVec(apply(multiply(a, IDENTITY), v), apply(a, v))
	})
})

describe("orbitOrientation", () => {
	const orbit: OrbitElements = {
		semiMajorAxisKm: 1000,
		eccentricity: 0.3,
		inclinationDeg: 40,
		longAscNodeDeg: 70,
		argPeriapsisDeg: 200,
		meanAnomalyDeg: 0,
		periodDays: 10,
		epochJD: 0,
	}

	it("agrees with the propagator's perifocal -> ecliptic rotation", () => {
		const m = orbitOrientation(orbit)
		for (const E of [0, 1, 2.5, 4, 6]) {
			const r = 1000 * (1 - 0.3 * Math.cos(E))
			const nu = trueAnomaly(E, 0.3)
			const perifocal: Vec3 = { x: r * Math.cos(nu), y: r * Math.sin(nu), z: 0 }
			expectVec(
				apply(m, perifocal),
				eclipticPositionAtEccentricAnomaly(orbit, E),
				6,
			)
		}
	})

	it("has the orbit normal as its third column", () => {
		const m = orbitOrientation(orbit)
		expectVec({ x: m[2], y: m[5], z: m[8] }, normalOf(orbit))
	})

	it("is inverted by elementsFromOrientation", () => {
		const cases: PlaneElements[] = [
			{ inclinationDeg: 40, longAscNodeDeg: 70, argPeriapsisDeg: 200 },
			{ inclinationDeg: 0.3, longAscNodeDeg: 359.9, argPeriapsisDeg: 0.1 },
			{ inclinationDeg: 157.3, longAscNodeDeg: 12, argPeriapsisDeg: 300 },
			{ inclinationDeg: 90, longAscNodeDeg: 180, argPeriapsisDeg: 90 },
		]
		for (const el of cases) {
			const back = elementsFromOrientation(orbitOrientation(el))
			expect(back.inclinationDeg).toBeCloseTo(el.inclinationDeg, 9)
			expect(back.longAscNodeDeg).toBeCloseTo(el.longAscNodeDeg, 9)
			expect(back.argPeriapsisDeg).toBeCloseTo(el.argPeriapsisDeg, 9)
		}
	})

	it("keeps a coplanar orbit (i = 0) propagating to the same positions", () => {
		const el: PlaneElements = {
			inclinationDeg: 0,
			longAscNodeDeg: 0,
			argPeriapsisDeg: 30,
		}
		const back = elementsFromOrientation(orbitOrientation(el))
		expect(back.inclinationDeg).toBeCloseTo(0, 9)
		// node undefined: whatever Omega came out, Omega + omega must still be 30
		expect((back.longAscNodeDeg + back.argPeriapsisDeg) % 360).toBeCloseTo(
			30,
			6,
		)
	})
})

describe("equatorToEcliptic", () => {
	it("maps the equator's z to the pole and its x to the ascending node on the ecliptic", () => {
		const m = equatorToEcliptic(URANUS_POLE)
		expectVec(apply(m, { x: 0, y: 0, z: 1 }), URANUS_POLE)
		const node = apply(m, { x: 1, y: 0, z: 0 })
		expect(node.z).toBeCloseTo(0, 12)
		expect(Math.hypot(node.x, node.y, node.z)).toBeCloseTo(1, 12)
		// motion along the equator through the node goes north
		expect(apply(m, { x: 0, y: 1, z: 0 }).z).toBeGreaterThan(0)
	})

	it("is the identity for the ecliptic pole", () => {
		const m = equatorToEcliptic(ECLIPTIC_POLE)
		for (let k = 0; k < 9; k++) expect(m[k]).toBeCloseTo(IDENTITY[k], 12)
	})

	it("is a proper rotation (orthonormal columns)", () => {
		const m = equatorToEcliptic(SATURN_POLE)
		const cols = [0, 1, 2].map((c) => ({ x: m[c], y: m[3 + c], z: m[6 + c] }))
		for (const c of cols) expect(Math.hypot(c.x, c.y, c.z)).toBeCloseTo(1, 12)
		expect(
			cols[0].x * cols[1].x + cols[0].y * cols[1].y + cols[0].z * cols[1].z,
		).toBeCloseTo(0, 12)
		const det =
			m[0] * (m[4] * m[8] - m[5] * m[7]) -
			m[1] * (m[3] * m[8] - m[5] * m[6]) +
			m[2] * (m[3] * m[7] - m[4] * m[6])
		expect(det).toBeCloseTo(1, 12)
	})
})

describe("rotateElementsToEcliptic", () => {
	it("puts an equatorial orbit's normal on the planet's pole", () => {
		const rotated = rotateElementsToEcliptic(
			{ inclinationDeg: 0, longAscNodeDeg: 123, argPeriapsisDeg: 45 },
			URANUS_POLE,
		)
		expect(angleDeg(normalOf(rotated), URANUS_POLE)).toBeCloseTo(0, 6)
		// Uranus's pole is 82.28 deg from the ecliptic pole
		expect(rotated.inclinationDeg).toBeCloseTo(82.28, 1)
	})

	it("keeps the inclination to the equator as the angle between orbit normal and pole", () => {
		for (const i of [0.35, 14.7, 90, 157.345]) {
			const rotated = rotateElementsToEcliptic(
				{ inclinationDeg: i, longAscNodeDeg: 200, argPeriapsisDeg: 10 },
				SATURN_POLE,
			)
			expect(angleDeg(normalOf(rotated), SATURN_POLE)).toBeCloseTo(i, 6)
			expect(rotated.longAscNodeDeg).toBeGreaterThanOrEqual(0)
			expect(rotated.longAscNodeDeg).toBeLessThan(360)
			expect(rotated.argPeriapsisDeg).toBeGreaterThanOrEqual(0)
			expect(rotated.argPeriapsisDeg).toBeLessThan(360)
		}
	})

	it("leaves elements alone when the planet's equator is the ecliptic", () => {
		const el: PlaneElements = {
			inclinationDeg: 5.1,
			longAscNodeDeg: 125,
			argPeriapsisDeg: 318,
		}
		const rotated = rotateElementsToEcliptic(el, ECLIPTIC_POLE)
		expect(rotated.inclinationDeg).toBeCloseTo(5.1, 9)
		expect(rotated.longAscNodeDeg).toBeCloseTo(125, 9)
		expect(rotated.argPeriapsisDeg).toBeCloseTo(318, 9)
	})

	it("moves the periapsis with the plane", () => {
		const el: PlaneElements = {
			inclinationDeg: 2,
			longAscNodeDeg: 30,
			argPeriapsisDeg: 60,
		}
		const m = equatorToEcliptic(SATURN_POLE)
		const rotated = rotateElementsToEcliptic(el, SATURN_POLE)
		const periapsisEq = apply(orbitOrientation(el), { x: 1, y: 0, z: 0 })
		const periapsisEcl = apply(orbitOrientation(rotated), { x: 1, y: 0, z: 0 })
		expectVec(periapsisEcl, apply(m, periapsisEq))
	})
})
