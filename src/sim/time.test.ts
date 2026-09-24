import { describe, expect, it } from "vitest"

import {
	HOURS_PER_DAY,
	J2000_JD,
	MS_PER_DAY,
	UNIX_EPOCH_JD,
	dateToJD,
	daysBetween,
	jdToDate,
	secondsToDays,
} from "./time"

describe("time", () => {
	it("maps 2000-01-01T12:00:00Z to J2000 exactly", () => {
		expect(J2000_JD).toBe(2451545.0)
		expect(dateToJD(new Date("2000-01-01T12:00:00Z"))).toBe(2451545.0)
		expect(jdToDate(J2000_JD).toISOString()).toBe("2000-01-01T12:00:00.000Z")
	})

	it("maps the Unix epoch to JD 2440587.5", () => {
		expect(dateToJD(new Date(0))).toBe(UNIX_EPOCH_JD)
		expect(UNIX_EPOCH_JD).toBe(2440587.5)
		expect(MS_PER_DAY).toBe(86_400_000)
		expect(HOURS_PER_DAY).toBe(24)
	})

	it("round-trips Date -> JD -> Date to the millisecond", () => {
		const samples = [
			new Date("1969-07-20T20:17:40.000Z"),
			new Date("2000-01-01T12:00:00.000Z"),
			new Date("2026-09-24T09:41:13.789Z"),
			new Date("2137-03-01T00:00:00.001Z"),
			new Date("1600-02-29T23:59:59.999Z"),
		]
		for (const date of samples) {
			expect(jdToDate(dateToJD(date)).getTime()).toBe(date.getTime())
		}
	})

	it("round-trips JD -> Date -> JD to well below a millisecond", () => {
		for (const jd of [2451545.0, 2451545.25, 2460000.123456, 2299160.5]) {
			expect(Math.abs(dateToJD(jdToDate(jd)) - jd)).toBeLessThan(
				0.5 / MS_PER_DAY,
			)
		}
	})

	it("measures day differences and converts seconds to days", () => {
		expect(daysBetween(J2000_JD, J2000_JD + 365.25)).toBe(365.25)
		expect(daysBetween(J2000_JD + 10, J2000_JD)).toBe(-10)
		expect(secondsToDays(86400)).toBe(1)
		expect(secondsToDays(3600)).toBeCloseTo(1 / 24, 15)
	})
})
