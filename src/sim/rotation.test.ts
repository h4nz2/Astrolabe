import { describe, expect, it } from "vitest"

import { TWO_PI, degToRad, type OrbitElements, type Vec3 } from "./kepler"
import {
	OBLIQUITY_J2000_DEG,
	eclipticDirection,
	equatorNode,
	rotationAngle,
	spinAxis,
} from "./rotation"
import { J2000_JD } from "./time"

const EARTH = { periodHours: 23.9345 }
const VENUS = { periodHours: -5832.6 }

// A Julian Date double near J2000 (~2.45e6) resolves about 40 microseconds,
// which is ~3e-9 rad of Earth spin, so "one turn" is only good to ~1e-8 rad.
const TURN_DIGITS = 8

const EPS = degToRad(OBLIQUITY_J2000_DEG)
const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z)
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const angleDeg = (a: Vec3, b: Vec3): number =>
	(Math.acos(Math.min(1, Math.max(-1, dot(a, b) / (length(a) * length(b))))) *
		180) /
	Math.PI
const expectVec = (actual: Vec3, expected: Vec3, digits = 9): void => {
	expect(actual.x).toBeCloseTo(expected.x, digits)
	expect(actual.y).toBeCloseTo(expected.y, digits)
	expect(actual.z).toBeCloseTo(expected.z, digits)
}

const orbit = (overrides: Partial<OrbitElements>): OrbitElements => ({
	semiMajorAxisKm: 1e6,
	eccentricity: 0,
	inclinationDeg: 0,
	longAscNodeDeg: 0,
	argPeriapsisDeg: 0,
	meanAnomalyDeg: 0,
	periodDays: 10,
	epochJD: J2000_JD,
	...overrides,
})

const EARTH_ORBIT = orbit({ inclinationDeg: 0 })
const MOON_ORBIT = orbit({ inclinationDeg: 5.145, longAscNodeDeg: 125.045 })
const EARTH_POLE = { axialTiltDeg: 23.4393, poleRaDeg: 0, poleDecDeg: 90 }
const URANUS_POLE = {
	axialTiltDeg: 82.23,
	poleRaDeg: 257.311,
	poleDecDeg: -15.175,
}
/** Earth's pole in the scene frame: ecliptic (0, sin e, cos e) -> (0, cos e, -sin e). */
const EARTH_AXIS_SCENE: Vec3 = { x: 0, y: Math.cos(EPS), z: -Math.sin(EPS) }

describe("rotationAngle", () => {
	it("is 0 at the epoch and advances 2pi per sidereal day for Earth", () => {
		expect(rotationAngle(EARTH, J2000_JD)).toBe(0)
		const siderealDay = EARTH.periodHours / 24
		const oneTurn = rotationAngle(EARTH, J2000_JD + siderealDay)
		expect(oneTurn).toBeCloseTo(TWO_PI, TURN_DIGITS)
		// unwrapped: keeps growing, and a 24 h solar day is a bit more than one turn
		expect(
			rotationAngle(EARTH, J2000_JD + 10 * siderealDay) - oneTurn,
		).toBeCloseTo(9 * TWO_PI, 8)
		expect(rotationAngle(EARTH, J2000_JD + 1)).toBeGreaterThan(TWO_PI)
		expect(rotationAngle(EARTH, J2000_JD + 1)).toBeCloseTo(
			(TWO_PI * 24) / EARTH.periodHours,
			9,
		)
	})

	it("rotates Venus the other way (negative period)", () => {
		const day = rotationAngle(VENUS, J2000_JD + 1)
		expect(day).toBeLessThan(0)
		expect(day).toBeCloseTo((-TWO_PI * 24) / 5832.6, 12)
		expect(Math.sign(day)).toBe(-Math.sign(rotationAngle(EARTH, J2000_JD + 1)))
		// one full Venus day is minus one turn
		expect(rotationAngle(VENUS, J2000_JD + 5832.6 / 24)).toBeCloseTo(
			-TWO_PI,
			TURN_DIGITS,
		)
	})

	it("is antisymmetric in time around the epoch", () => {
		expect(rotationAngle(EARTH, J2000_JD - 3)).toBeCloseTo(
			-rotationAngle(EARTH, J2000_JD + 3),
			12,
		)
	})

	it("honours a custom epoch", () => {
		expect(rotationAngle(EARTH, 2460000, 2460000)).toBe(0)
		expect(
			rotationAngle(EARTH, 2460000 + EARTH.periodHours / 24, 2460000),
		).toBeCloseTo(TWO_PI, TURN_DIGITS)
	})

	it("starts at the IAU prime meridian angle W0 when one is given", () => {
		const earth = { periodHours: 23.9345, primeMeridianDeg: 190.147 }
		expect(rotationAngle(earth, J2000_JD)).toBeCloseTo(degToRad(190.147), 12)
		expect(rotationAngle(earth, J2000_JD + 23.9345 / 24)).toBeCloseTo(
			degToRad(190.147) + TWO_PI,
			TURN_DIGITS,
		)
		// W0 goes with the spin: Venus's W decreases from 160.20
		const venus = { periodHours: -5832.5, primeMeridianDeg: 160.2 }
		expect(rotationAngle(venus, J2000_JD + 1)).toBeLessThan(degToRad(160.2))
	})

	it("returns 0 when the period is unknown or degenerate", () => {
		expect(rotationAngle({ periodHours: null }, J2000_JD + 100)).toBe(0)
		expect(rotationAngle({ periodHours: 0 }, J2000_JD + 100)).toBe(0)
		expect(rotationAngle({ periodHours: Infinity }, J2000_JD + 100)).toBe(0)
		expect(
			rotationAngle({ periodHours: null, primeMeridianDeg: 90 }, J2000_JD),
		).toBe(0)
	})
})

describe("eclipticDirection", () => {
	it("maps the celestial pole 23.44 deg from the ecliptic pole and the equinox onto x", () => {
		expectVec(eclipticDirection(0, 90), {
			x: 0,
			y: Math.sin(EPS),
			z: Math.cos(EPS),
		})
		expectVec(eclipticDirection(0, 0), { x: 1, y: 0, z: 0 })
		expectVec(eclipticDirection(90, 0), {
			x: 0,
			y: Math.cos(EPS),
			z: -Math.sin(EPS),
		})
	})

	it("returns unit vectors and writes into `out`", () => {
		const out: Vec3 = { x: 9, y: 9, z: 9 }
		expect(eclipticDirection(257.311, -15.175, out)).toBe(out)
		expect(length(out)).toBeCloseTo(1, 12)
	})
})

describe("spinAxis", () => {
	it("uses the IAU pole when present: Earth's axis leans toward ecliptic longitude 90", () => {
		expectVec(spinAxis(EARTH_POLE, EARTH_ORBIT), EARTH_AXIS_SCENE)
		// the same without an orbit (the pole does not need one)
		expectVec(spinAxis(EARTH_POLE, null), EARTH_AXIS_SCENE)
	})

	it("Uranus's pole lies almost in the ecliptic plane, 82.3 deg from the ecliptic pole", () => {
		const axis = spinAxis(URANUS_POLE, orbit({ inclinationDeg: 0.77 }))
		expect(angleDeg(axis, { x: 0, y: 1, z: 0 })).toBeCloseTo(82.28, 1)
		expect(axis.y).toBeGreaterThan(0) // the IAU north pole is north of the ecliptic
	})

	it("falls back to tilting the orbit normal toward the ecliptic pole", () => {
		// Earth without an IAU pole: 23.44 deg from scene +Y toward -Z, same as the IAU pole
		expectVec(
			spinAxis({ axialTiltDeg: 23.4393 }, EARTH_ORBIT),
			EARTH_AXIS_SCENE,
			6,
		)
		// no orbit at all: the ecliptic pole is the reference
		expectVec(spinAxis({ axialTiltDeg: 0 }, null), { x: 0, y: 1, z: 0 })
		expectVec(spinAxis({ axialTiltDeg: 23.4393 }, null), EARTH_AXIS_SCENE, 6)
	})

	it("gives a tidally locked moon (tilt 0) its orbit normal", () => {
		// i = 90, Omega = 0: the normal is ecliptic -y, i.e. scene +Z
		expectVec(spinAxis({ axialTiltDeg: 0 }, orbit({ inclinationDeg: 90 })), {
			x: 0,
			y: 0,
			z: 1,
		})
		const inclined = orbit({ inclinationDeg: 157.345, longAscNodeDeg: 61 })
		const axis = spinAxis({ axialTiltDeg: 0 }, inclined)
		expect(angleDeg(axis, { x: 0, y: 1, z: 0 })).toBeCloseTo(157.345, 6)
	})

	it("puts the Moon's 6.68 deg obliquity on the far side of the ecliptic pole (1.54 deg)", () => {
		const axis = spinAxis({ axialTiltDeg: 6.68 }, MOON_ORBIT)
		expect(angleDeg(axis, { x: 0, y: 1, z: 0 })).toBeCloseTo(6.68 - 5.145, 6)
		// and it stays 6.68 deg from the orbit normal
		const normal = spinAxis({ axialTiltDeg: 0 }, MOON_ORBIT)
		expect(angleDeg(axis, normal)).toBeCloseTo(6.68, 6)
	})

	it("returns unit vectors and writes into `out`", () => {
		const out: Vec3 = { x: 9, y: 9, z: 9 }
		expect(spinAxis(URANUS_POLE, null, out)).toBe(out)
		expect(length(out)).toBeCloseTo(1, 12)
		expect(length(spinAxis({ axialTiltDeg: 45 }, MOON_ORBIT))).toBeCloseTo(
			1,
			12,
		)
	})
})

describe("equatorNode", () => {
	it("is perpendicular to the spin axis in both branches", () => {
		for (const [rotation, o] of [
			[EARTH_POLE, EARTH_ORBIT],
			[URANUS_POLE, null],
			[{ axialTiltDeg: 6.68 }, MOON_ORBIT],
			[
				{ axialTiltDeg: 0 },
				orbit({ inclinationDeg: 157.345, longAscNodeDeg: 61 }),
			],
			[{ axialTiltDeg: 0 }, null],
		] as const) {
			const node = equatorNode(rotation, o)
			expect(length(node)).toBeCloseTo(1, 12)
			expect(dot(node, spinAxis(rotation, o))).toBeCloseTo(0, 12)
		}
	})

	it("is the ICRF node (right ascension pole + 90) for an IAU pole", () => {
		// Earth: RA 90, Dec 0 -> ecliptic (0, cos e, -sin e) -> scene (0, -sin e, -cos e)
		expectVec(equatorNode(EARTH_POLE, EARTH_ORBIT), {
			x: 0,
			y: -Math.sin(EPS),
			z: -Math.cos(EPS),
		})
	})

	it("falls back to the node on the ecliptic, or +X for an untilted body", () => {
		expectVec(equatorNode({ axialTiltDeg: 0 }, null), { x: 1, y: 0, z: 0 })
		const node = equatorNode({ axialTiltDeg: 23.4393 }, EARTH_ORBIT)
		expect(node.y).toBeCloseTo(0, 12) // in the ecliptic plane
		expectVec(node, { x: -1, y: 0, z: 0 }, 6) // ecliptic pole x axis(0, c, -s) = (-s, 0, 0) normalized
	})
})
