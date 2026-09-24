import { GeoMoon, RotateVector, Rotation_EQJ_ECL } from "astronomy-engine"
import { describe, expect, it } from "vitest"

import { getBody } from "@/data"

import {
	meanAnomalyAt,
	orbitAt,
	propagate,
	propagateEcliptic,
	type OrbitElements,
} from "./kepler"
import { separationDeg } from "./testing/ephemeris"
import { J2000_JD, jdToDate } from "./time"

const moonOrbit = (): OrbitElements => {
	const orbit = getBody("moon").orbit
	if (orbit === null) throw new Error("the Moon has an orbit")
	return orbit
}

describe("orbit precession", () => {
	it("leaves an orbit without precession unchanged", () => {
		const earth = getBody("earth").orbit
		if (earth === null) throw new Error("earth has an orbit")
		const at = orbitAt(earth, J2000_JD + 5000)
		expect(at).toMatchObject({ ...earth })
		expect(at.precession).toBeUndefined()
	})

	it("turns the Moon's node once in 18.6 years and its perigee once in 8.85", () => {
		const { precession } = moonOrbit()
		if (precession === undefined) throw new Error("the Moon precesses")
		const year = 365.25
		expect(-360 / precession.nodeDegPerDay / year).toBeCloseTo(18.6, 1)
		// longitude of perigee = node + argument of perigee
		const perigee = precession.nodeDegPerDay + precession.argPeriapsisDegPerDay
		expect(360 / perigee / year).toBeCloseTo(8.85, 2)
	})

	it("runs the anomaly at the anomalistic month and the longitude at the sidereal one", () => {
		const orbit = moonOrbit()
		const days = 27.55455 // anomalistic month
		const turn =
			meanAnomalyAt(orbit, J2000_JD + days) - meanAnomalyAt(orbit, J2000_JD)
		expect(Math.abs(Math.sin(turn))).toBeLessThan(1e-3)
	})

	it("propagates on the ellipse orbitAt describes at that moment", () => {
		const orbit = moonOrbit()
		for (const jd of [J2000_JD - 3000, J2000_JD + 1234.5, J2000_JD + 9000]) {
			const a = propagate(orbit, jd)
			const b = propagate(orbitAt(orbit, jd), jd)
			expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-6)
		}
	})

	it("keeps the Moon within 2.5 deg of the ephemeris from 2000 to 2045 (16 deg without precession)", () => {
		const orbit = moonOrbit()
		const toEcliptic = Rotation_EQJ_ECL()
		let worst = 0
		for (let jd = J2000_JD; jd < J2000_JD + 45 * 365.25; jd += 7.3) {
			const reference = RotateVector(toEcliptic, GeoMoon(jdToDate(jd)))
			worst = Math.max(
				worst,
				separationDeg(propagateEcliptic(orbit, jd), reference),
			)
		}
		expect(worst).toBeLessThan(2.5)
	})
})
