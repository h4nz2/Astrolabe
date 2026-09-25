import { describe, expect, it } from "vitest"

import { getBody } from "@/data"

import {
	AGE_WORLD_IDS,
	WEIGHT_WORLD_IDS,
	anniversary,
	birthdayFacts,
	calendarAge,
	calendarStart,
	formatBigNumber,
	formatKg,
	hasNoSurface,
	localDay,
	nextCalendarBirthday,
	orbitLengthKm,
	solarDayDays,
	surfaceGravity,
	weightOn,
} from "./birthday"

/** A local noon, so the local calendar day is unambiguous in every time zone. */
const at = (day: string) => new Date(`${day}T12:00:00`)

const world = (facts: ReturnType<typeof birthdayFacts>, id: string) => {
	const found = facts.worlds.find((entry) => entry.id === id)
	if (found === undefined) throw new Error(id)
	return found
}

describe("calendar ages", () => {
	it("counts birthdays like people do", () => {
		expect(calendarAge("2014-09-25", "2026-09-24")).toBe(11)
		expect(calendarAge("2014-09-25", "2026-09-25")).toBe(12)
		expect(calendarAge("2026-09-25", "2026-09-25")).toBe(0)
		expect(calendarAge("2026-09-20", "2026-09-25")).toBe(0)
	})

	it("gives a 29 February birthday the 28th in other years", () => {
		expect(anniversary("2012-02-29", 2026)).toBe("2026-02-28")
		expect(anniversary("2012-02-29", 2028)).toBe("2028-02-29")
		expect(calendarAge("2012-02-29", "2026-02-28")).toBe(14)
		expect(calendarAge("2012-02-29", "2026-02-27")).toBe(13)
		expect(nextCalendarBirthday("2012-02-29", "2027-03-01")).toBe("2028-02-29")
	})

	it("finds the next calendar birthday strictly after today", () => {
		expect(nextCalendarBirthday("2014-09-25", "2026-09-24")).toBe("2026-09-25")
		expect(nextCalendarBirthday("2014-09-25", "2026-09-25")).toBe("2027-09-25")
	})

	it("uses the viewer's own calendar day and opens the calendar ten years back", () => {
		expect(localDay(at("2026-01-05"))).toBe("2026-01-05")
		expect(calendarStart(at("2026-09-25"))).toBe("2016-01-01")
	})
})

describe("physics from the body data", () => {
	it("derives solar days from sidereal spin and year", () => {
		expect(solarDayDays(getBody("earth"))).toBeCloseTo(1, 3)
		expect(solarDayDays(getBody("mercury"))).toBeCloseTo(175.94, 0)
		// retrograde: the Sun rises about every 117 Earth days on Venus
		expect(solarDayDays(getBody("venus"))).toBeCloseTo(116.75, 0)
		expect(solarDayDays(getBody("mars"))! * 24).toBeCloseTo(24.66, 1)
		expect(solarDayDays(getBody("sun"))).toBeNull()
	})

	it("agrees with the curated day lengths", () => {
		for (const id of AGE_WORLD_IDS) {
			const body = getBody(id)
			const curatedHours = body.info.lengthOfDay as number
			expect(
				Math.abs(solarDayDays(body)! * 24 - curatedHours) / curatedHours,
			).toBeLessThan(0.02)
		}
	})

	it("takes the curated gravity and falls back to G M / R²", () => {
		expect(surfaceGravity(getBody("mars"))).toBe(3.71)
		const earth = getBody("earth")
		const computed = surfaceGravity({ ...earth, info: {} })!
		expect(computed).toBeCloseTo(9.82, 1)
		const moon = getBody("moon")
		expect(surfaceGravity({ ...moon, info: {} })).toBeCloseTo(1.62, 1)
		expect(surfaceGravity({ ...moon, info: {}, massKg: null })).toBeNull()
	})

	it("weighs the issue's 40 kg student", () => {
		expect(weightOn(getBody("earth"), 40)).toBeCloseTo(40, 6)
		expect(weightOn(getBody("mars"), 40)).toBeCloseTo(15.1, 1)
		expect(weightOn(getBody("jupiter"), 40)).toBeCloseTo(101.2, 1)
		expect(weightOn(getBody("moon"), 40)).toBeCloseTo(6.6, 1)
	})

	it("lists weights for the Sun, the planets and the large moons, each after its planet", () => {
		expect(WEIGHT_WORLD_IDS.slice(0, 5)).toEqual([
			"sun",
			"mercury",
			"venus",
			"earth",
			"moon",
		])
		expect(WEIGHT_WORLD_IDS).toContain("triton")
		expect(WEIGHT_WORLD_IDS.at(-1)).toBe("triton")
		for (const id of WEIGHT_WORLD_IDS) {
			expect(weightOn(getBody(id), 40)).toBeGreaterThan(0)
		}
		expect(hasNoSurface(getBody("saturn"))).toBe(true)
		expect(hasNoSurface(getBody("titan"))).toBe(false)
	})

	it("measures Earth's orbit at about 940 million km", () => {
		expect(orbitLengthKm(getBody("earth"))! / 1e6).toBeCloseTo(940, -1)
	})
})

describe("birthdayFacts", () => {
	// the issue's twelve-year-old
	const facts = birthdayFacts("2014-09-25", at("2026-09-25"))

	it("gives the age on every planet", () => {
		expect(facts.worlds.map((entry) => entry.id)).toEqual(AGE_WORLD_IDS)
		expect(world(facts, "earth").age).toBe(12)
		expect(world(facts, "mars").age).toBe(6)
		expect(world(facts, "mercury").age).toBe(49)
		expect(world(facts, "jupiter").age).toBe(1)
		expect(world(facts, "neptune").age).toBe(0)
		// an eleven-year-old has not had a first birthday on Jupiter yet
		const eleven = birthdayFacts("2015-09-25", at("2026-09-25"))
		expect(world(eleven, "jupiter").age).toBe(0)
	})

	it("says happy birthday on Earth only on the day", () => {
		expect(world(facts, "earth").birthdayToday).toBe(true)
		expect(world(facts, "earth").nextDay).toBe("2027-09-25")
		const before = birthdayFacts("2014-09-25", at("2026-09-24"))
		expect(world(before, "earth").birthdayToday).toBe(false)
		expect(world(before, "earth").nextDay).toBe("2026-09-25")
	})

	it("puts the next birthday where the planet is back where it was", () => {
		const mars = world(facts, "mars")
		const year = getBody("mars").orbit!.periodDays
		expect(mars.nextJD - facts.birthJD).toBeCloseTo(7 * year, 6)
		expect(mars.nextJD).toBeGreaterThan(facts.nowJD)
		expect(mars.nextJD - facts.nowJD).toBeLessThanOrEqual(year)
		const neptune = world(facts, "neptune")
		// Neptune's first birthday: 164.8 Earth years after birth
		expect(neptune.nextDay.slice(0, 4)).toBe("2179")
		expect(neptune.earthAgeThen).toBe(164)
	})

	it("counts local days lived: few on Mercury, many on Jupiter", () => {
		// 4383 calendar days; one fewer where local noon comes before noon UTC
		expect(world(facts, "earth").daysLived).toBeGreaterThanOrEqual(4382)
		expect(world(facts, "earth").daysLived).toBeLessThanOrEqual(4383)
		expect(world(facts, "mercury").daysLived).toBe(24)
		expect(world(facts, "venus").daysLived).toBe(37)
		expect(world(facts, "jupiter").daysLived).toBeGreaterThan(10_000)
	})

	it("carries you about 11 billion km around the Sun in twelve years", () => {
		expect(facts.distanceKm / 1e9).toBeCloseTo(11.28, 1)
		expect(facts.orbitSpeedKmS).toBeCloseTo(29.8, 1)
		expect(facts.moonTrips).toBeCloseTo(14_700, -2)
	})

	it("is all zeros for someone born today", () => {
		const baby = birthdayFacts("2026-09-25", at("2026-09-25"))
		for (const entry of baby.worlds) expect(entry.age).toBe(0)
		expect(world(baby, "earth").birthdayToday).toBe(false)
		expect(baby.distanceKm).toBeGreaterThanOrEqual(0)
	})
})

describe("formatting", () => {
	it("says big distances in words", () => {
		expect(formatBigNumber(11.28e9, "en")).toBe("11.3 billion")
		expect(formatBigNumber(11.28e9, "de")).toBe("11,3 Milliarden")
		expect(formatBigNumber(123_456, "en")).toBe("123,456")
	})

	it("rounds weights to what a scale would show", () => {
		expect(formatKg(15.137, "en")).toBe("15.1")
		expect(formatKg(1119.6, "de")).toBe("1.120")
	})
})
