/**
 * Product decision of issue #9: the simulation models Kepler's second law.
 * Bodies sweep equal areas in equal times, so they move measurably faster at
 * perihelion than at aphelion, instead of at a uniform angular speed. These
 * tests pin that on the real planet data.
 */
import { describe, expect, it } from "vitest"

import { bodyById } from "@/data"

import { degToRad, propagate, type OrbitElements, type Vec3 } from "./kepler"

const orbitOf = (id: string): OrbitElements => {
	const orbit = bodyById.get(id)?.orbit
	if (!orbit) throw new Error(`no orbit for ${id}`)
	return orbit
}

/** Julian Date at which the body passes mean anomaly `meanAnomalyDeg` (0 perihelion, 180 aphelion). */
const jdAtMeanAnomaly = (orbit: OrbitElements, meanAnomalyDeg: number) =>
	orbit.epochJD +
	((((meanAnomalyDeg - orbit.meanAnomalyDeg) % 360) + 360) % 360) *
		(orbit.periodDays / 360)

const angleBetween = (a: Vec3, b: Vec3): number => {
	const dot = a.x * b.x + a.y * b.y + a.z * b.z
	const cross = Math.hypot(
		a.y * b.z - a.z * b.y,
		a.z * b.x - a.x * b.z,
		a.x * b.y - a.y * b.x,
	)
	return Math.atan2(cross, dot)
}

/** Angle (radians) the body sweeps around its parent in `spanDays` centred on `jd`, and the area of that sector (km^2). */
function sweep(orbit: OrbitElements, jd: number, spanDays: number) {
	const steps = 64
	let angle = 0
	let area = 0
	let previous = propagate(orbit, jd - spanDays / 2)
	for (let i = 1; i <= steps; i++) {
		const next = propagate(orbit, jd - spanDays / 2 + (spanDays * i) / steps)
		angle += angleBetween(previous, next)
		// triangle fan from the focus; fine enough at 64 steps for a few days of arc
		area +=
			Math.hypot(
				previous.y * next.z - previous.z * next.y,
				previous.z * next.x - previous.x * next.z,
				previous.x * next.y - previous.y * next.x,
			) / 2
		previous = next
	}
	return { angle, area }
}

describe("Kepler's second law (issue #9 decision: modelled)", () => {
	it.each([
		["mercury", 0.2056],
		["mars", 0.0935],
	])(
		"%s moves faster at perihelion by exactly ((1+e)/(1-e))^2",
		(id, eccentricity) => {
			const orbit = orbitOf(id)
			expect(orbit.eccentricity).toBeCloseTo(eccentricity, 3)
			const span = orbit.periodDays / 200
			const perihelion = sweep(orbit, jdAtMeanAnomaly(orbit, 0), span)
			const aphelion = sweep(orbit, jdAtMeanAnomaly(orbit, 180), span)
			const e = orbit.eccentricity
			const expected = ((1 + e) / (1 - e)) ** 2
			// Mercury: 2.30x, Mars: 1.45x
			expect(perihelion.angle / aphelion.angle).toBeCloseTo(expected, 2)
			expect(perihelion.angle / aphelion.angle).toBeGreaterThan(1.4)
			// equal areas in equal times
			expect(perihelion.area / aphelion.area).toBeCloseTo(1, 3)
		},
	)

	it("Venus stays close to uniform (e = 0.0067), as the issue predicted", () => {
		const orbit = orbitOf("venus")
		const span = orbit.periodDays / 200
		const ratio =
			sweep(orbit, jdAtMeanAnomaly(orbit, 0), span).angle /
			sweep(orbit, jdAtMeanAnomaly(orbit, 180), span).angle
		expect(ratio).toBeGreaterThan(1)
		expect(ratio).toBeLessThan(1.03)
	})

	it("the mean angular speed is still one orbit per period", () => {
		const orbit = orbitOf("mercury")
		const full = sweep(orbit, jdAtMeanAnomaly(orbit, 0), orbit.periodDays)
		expect(full.angle).toBeCloseTo(degToRad(360), 2)
	})
})
