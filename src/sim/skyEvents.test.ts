import { describe, expect, it } from "vitest"

import { bodies } from "@/data"

import {
	SkyGeometry,
	bestInstant,
	eclipticLongitudeDeg,
	longitudeArc,
	measureEvent,
	ringTiltFromEarthDeg,
} from "./skyEvents"
import { dateToJD } from "./time"

const geometry = new SkyGeometry(bodies)
const jd = (iso: string) => dateToJD(new Date(iso))

describe("longitudeArc", () => {
	it("finds the smallest arc holding every longitude, across 0 degrees too", () => {
		expect(longitudeArc([10, 20, 40])).toEqual({ spanDeg: 30, middleDeg: 25 })
		const wrapped = longitudeArc([350, 10, 30])
		expect(wrapped.spanDeg).toBeCloseTo(40, 10)
		expect(wrapped.middleDeg).toBeCloseTo(10, 10)
		expect(longitudeArc([42]).spanDeg).toBe(0)
	})

	it("reads the ecliptic longitude from scene axes (ecliptic y is scene -z)", () => {
		expect(eclipticLongitudeDeg([1, 0, 0])).toBeCloseTo(0, 10)
		expect(eclipticLongitudeDeg([0, 0, -1])).toBeCloseTo(90, 10)
		expect(eclipticLongitudeDeg([-1, 5, 0])).toBeCloseTo(180, 10)
	})
})

describe("measureEvent in the app's simulation", () => {
	it("finds the total solar eclipse of 8 April 2024 and where it is total", () => {
		const check = { kind: "solarEclipse", type: "total" } as const
		const t = bestInstant(geometry, check, jd("2024-04-08T18:17:19Z"))
		const measure = measureEvent(geometry, check, t)
		expect(measure.type).toBe("total")
		expect(measure.sunlight).toBe(0)
		// the observer stands on the Earth's surface
		const [x, y, z] = measure.surfaceKm ?? [0, 0, 0]
		expect(Math.hypot(x, y, z)).toBeCloseTo(geometry.radius("earth"), 3)
		// a fortnight later the Moon is behind the Earth: no solar eclipse at all
		const later = measureEvent(geometry, check, t + 14.8)
		expect(later.happens).toBe(false)
		expect(later.metric).toBe(Number.POSITIVE_INFINITY)
	})

	it("tells annular from total by the Moon's apparent size", () => {
		const check = { kind: "solarEclipse", type: "annular" } as const
		const t = bestInstant(geometry, check, jd("2027-02-06T15:59:33Z"))
		const measure = measureEvent(geometry, check, t)
		expect(measure.type).toBe("annular")
		// a ring of the Sun stays visible
		expect(measure.sunlight).toBeGreaterThan(0.05)
		expect(measure.sunlight).toBeLessThan(0.2)
	})

	it("does not claim an eclipse the model misses: 20 March 2015 stays partial", () => {
		const check = { kind: "solarEclipse", type: "total" } as const
		const t = bestInstant(geometry, check, jd("2015-03-20T09:45:41Z"))
		expect(measureEvent(geometry, check, t).happens).toBe(false)
	})

	it("puts the whole Moon in the Earth's umbra for a total lunar eclipse only", () => {
		const total = { kind: "lunarEclipse", type: "total" } as const
		const t = bestInstant(geometry, total, jd("2025-03-14T06:58:42Z"))
		expect(measureEvent(geometry, total, t).type).toBe("total")
		// half an orbit later there is nothing
		expect(measureEvent(geometry, total, t + 14.8).happens).toBe(false)
	})

	it("sees Mercury on the Sun on 11 November 2019, and not a day later", () => {
		const check = { kind: "transit", body: "mercury" } as const
		const t = bestInstant(geometry, check, jd("2019-11-11T15:18:53Z"))
		expect(measureEvent(geometry, check, t).happens).toBe(true)
		expect(measureEvent(geometry, check, t + 1).happens).toBe(false)
	})

	it("measures the Great Conjunction of 2020 at about a tenth of a degree", () => {
		const check = {
			kind: "conjunction",
			bodies: ["jupiter", "saturn"],
			maxDeg: 0.2,
		} as const
		const t = bestInstant(geometry, check, jd("2020-12-21T18:26:36Z"))
		const { angleDeg } = measureEvent(geometry, check, t)
		expect(angleDeg).toBeGreaterThan(0.05)
		expect(angleDeg).toBeLessThan(0.15)
	})

	it("turns Saturn's rings edge-on to the Earth in March 2025", () => {
		const t = bestInstant(
			geometry,
			{ kind: "ringPlaneCrossing", body: "saturn" },
			jd("2025-03-23T14:48:00Z"),
		)
		expect(Math.abs(ringTiltFromEarthDeg(geometry, "saturn", t))).toBeLessThan(
			0.001,
		)
		// half a Saturn year later they are wide open again
		expect(
			Math.abs(ringTiltFromEarthDeg(geometry, "saturn", t + 365.25 * 7)),
		).toBeGreaterThan(20)
	})
})
