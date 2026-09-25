import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"

import {
	LIGHT_YEAR_KM,
	SPEED_OF_LIGHT_KM_S,
	arrivalJD,
	distanceBetweenKm,
	distanceRangeKm,
	frontRadiusKm,
	lightDistanceKm,
	lightSeconds,
	neighbourhoodRadiusKm,
	secondsSince,
	truePositionAt,
} from "./light"
import { buildIndex, computePositions } from "./positions"
import { dateToJD } from "./time"
import { AU_KM, SECONDS_PER_DAY } from "./units"

const index = buildIndex(bodies)
const byId = new Map(bodies.map((body) => [body.id, body]))
const at = (id: string): number => index.get(id)!
const JD = dateToJD(new Date("2026-09-25T12:00:00Z"))

describe("light arithmetic", () => {
	it("uses the defined speed of light", () => {
		expect(SPEED_OF_LIGHT_KM_S).toBe(299792.458)
		// one astronomical unit is 499.005 light-seconds: "8 minutes 20 seconds"
		expect(lightSeconds(AU_KM)).toBeCloseTo(499.004784, 5)
		expect(lightDistanceKm(1)).toBe(SPEED_OF_LIGHT_KM_S)
		expect(LIGHT_YEAR_KM).toBeCloseTo(9.4607e12, -9)
	})

	it("measures a pulse's age and radius in simulation time", () => {
		const emit = 2461000
		expect(secondsSince(emit, emit + 1 / 24)).toBeCloseTo(3600, 3)
		// a JD near 2.46 million days resolves about 40 µs, i.e. about 12 km of light
		expect(
			frontRadiusKm(emit, emit + 1 / SECONDS_PER_DAY) / SPEED_OF_LIGHT_KM_S,
		).toBeCloseTo(1, 4)
		// before it was sent (time reversed): no front at all
		expect(secondsSince(emit, emit - 1 / 24)).toBeCloseTo(-3600, 3)
		expect(frontRadiusKm(emit, emit - 1)).toBe(0)
	})
})

describe("truePositionAt", () => {
	it("agrees with computePositions for planets and moons", () => {
		const all = computePositions(bodies, JD)
		for (const id of ["sun", "earth", "moon", "jupiter", "io", "neptune"]) {
			const i = at(id)
			const p = truePositionAt(bodies, index, i, JD, new Float64Array(3))
			expect(p[0]).toBeCloseTo(all[i * 3], 3)
			expect(p[1]).toBeCloseTo(all[i * 3 + 1], 3)
			expect(p[2]).toBeCloseTo(all[i * 3 + 2], 3)
		}
	})
})

describe("arrivalJD", () => {
	const sunOrigin = new Float64Array(3)

	it("reaches Earth from the Sun in about 8 min 20 s and Neptune in about 4 h", () => {
		const earth =
			(arrivalJD(bodies, index, at("earth"), sunOrigin, JD) - JD) * 86400
		expect(earth).toBeGreaterThan(8 * 60 + 5)
		expect(earth).toBeLessThan(8 * 60 + 30)
		const neptune =
			(arrivalJD(bodies, index, at("neptune"), sunOrigin, JD) - JD) * 86400
		expect(neptune / 3600).toBeGreaterThan(4)
		expect(neptune / 3600).toBeLessThan(4.3)
	})

	it("meets the body where it is when the light arrives, not where it was", () => {
		const earthIndex = at("earth")
		const origin = truePositionAt(
			bodies,
			index,
			at("mars"),
			JD,
			new Float64Array(3),
		)
		const jd = arrivalJD(bodies, index, earthIndex, origin, JD)
		const there = truePositionAt(
			bodies,
			index,
			earthIndex,
			jd,
			new Float64Array(3),
		)
		const travelled = Math.hypot(
			there[0] - origin[0],
			there[1] - origin[1],
			there[2] - origin[2],
		)
		// the light sphere's radius equals the distance at arrival, to 0.1 ms (a JD resolves ~40 µs)
		const radius = frontRadiusKm(JD, jd)
		expect(Math.abs(travelled - radius) / SPEED_OF_LIGHT_KM_S).toBeLessThan(
			1e-4,
		)
		// and that differs from the naive "distance at sending" by Earth's motion (~30 km/s)
		const naive = distanceBetweenKm(bodies, index, at("mars"), earthIndex, JD)
		expect(Math.abs(naive - travelled)).toBeGreaterThan(1000)
	})
})

describe("neighbourhoodRadiusKm", () => {
	it("is the Hill sphere: Earth's reaches 1.5 million km and holds the Moon", () => {
		const earth = neighbourhoodRadiusKm(getBody("earth"), getBody("sun"))
		expect(earth).toBeGreaterThan(1.45e6)
		expect(earth).toBeLessThan(1.52e6)
		expect(earth).toBeGreaterThan(getBody("moon").orbit!.semiMajorAxisKm * 3)
		const jupiter = neighbourhoodRadiusKm(getBody("jupiter"), getBody("sun"))
		expect(jupiter).toBeGreaterThan(4.5e7)
	})

	it("is everything for the Sun", () => {
		expect(neighbourhoodRadiusKm(getBody("sun"), undefined)).toBe(Infinity)
	})
})

describe("distanceRangeKm", () => {
	const minutes = (km: number) => lightSeconds(km) / 60

	it("puts Mars 3 to 22 light-minutes from Earth", () => {
		const range = distanceRangeKm(getBody("earth"), getBody("mars"), byId)
		expect(minutes(range.min)).toBeGreaterThan(2.9)
		expect(minutes(range.min)).toBeLessThan(3.2)
		expect(minutes(range.max)).toBeGreaterThan(22)
		expect(minutes(range.max)).toBeLessThan(22.7)
	})

	it("handles inner planets, the Sun and the Moon", () => {
		const venus = distanceRangeKm(getBody("earth"), getBody("venus"), byId)
		expect(venus.min / AU_KM).toBeCloseTo(0.255, 2)
		const sun = distanceRangeKm(getBody("earth"), getBody("sun"), byId)
		expect(sun.min / AU_KM).toBeCloseTo(0.983, 2)
		expect(sun.max / AU_KM).toBeCloseTo(1.017, 2)
		const moon = distanceRangeKm(getBody("earth"), getBody("moon"), byId)
		expect(lightSeconds(moon.min)).toBeCloseTo(1.21, 1)
		expect(lightSeconds(moon.max)).toBeCloseTo(1.36, 1)
	})

	it("widens a planet's range by a moon's orbit for moons of other planets", () => {
		const jupiter = distanceRangeKm(getBody("earth"), getBody("jupiter"), byId)
		const io = distanceRangeKm(getBody("earth"), getBody("io"), byId)
		expect(io.min).toBeLessThan(jupiter.min)
		expect(io.max).toBeGreaterThan(jupiter.max)
	})

	it("contains the live distance at any time", () => {
		for (let k = 0; k < 40; k++) {
			const jd = JD + k * 97.3
			const d = distanceBetweenKm(bodies, index, at("earth"), at("mars"), jd)
			const range = distanceRangeKm(getBody("earth"), getBody("mars"), byId)
			expect(d).toBeGreaterThanOrEqual(range.min * 0.99)
			expect(d).toBeLessThanOrEqual(range.max * 1.01)
		}
	})
})
