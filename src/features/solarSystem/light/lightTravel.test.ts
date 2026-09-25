import { describe, expect, it } from "vitest"

import { createI18n } from "@/i18n"
import { dateToJD } from "@/sim"

import {
	BEYOND,
	LIGHT_BODY_IDS,
	durationParts,
	formatDuration,
	pulseArrivals,
	pulseTargetIds,
	roughSeconds,
	signalDelay,
} from "./lightTravel"

const JD = dateToJD(new Date("2026-09-25T12:00:00Z"))
const YEAR = 365.25 * 86400

describe("durationParts", () => {
	it("splits into the units a person reads", () => {
		expect(durationParts(1.284)).toEqual([{ unit: "second", value: 1.3 }])
		expect(durationParts(42.4)).toEqual([{ unit: "second", value: 42 }])
		expect(durationParts(499)).toEqual([
			{ unit: "minute", value: 8 },
			{ unit: "second", value: 19 },
		])
		expect(durationParts(4 * 3600 + 10 * 60 + 12)).toEqual([
			{ unit: "hour", value: 4 },
			{ unit: "minute", value: 10 },
		])
		expect(durationParts(4 * 3600 + 10 * 60 + 12, true)).toEqual([
			{ unit: "hour", value: 4 },
			{ unit: "minute", value: 10 },
			{ unit: "second", value: 12 },
		])
		expect(durationParts(3 * 86400 + 5 * 3600)).toEqual([
			{ unit: "day", value: 3 },
			{ unit: "hour", value: 5 },
		])
		expect(durationParts(4.2465 * YEAR)).toEqual([{ unit: "year", value: 4.2 }])
		expect(durationParts(26_000 * YEAR)).toEqual([
			{ unit: "year", value: 26_000 },
		])
	})

	it("carries instead of showing 60 s or 60 min", () => {
		expect(durationParts(9.97)).toEqual([{ unit: "second", value: 10 }])
		expect(durationParts(59.6)).toEqual([{ unit: "minute", value: 1 }])
		expect(durationParts(3599.6)).toEqual([{ unit: "hour", value: 1 }])
		expect(durationParts(2 * 3600 + 59 * 60 + 50)).toEqual([
			{ unit: "hour", value: 3 },
		])
		expect(durationParts(86400 - 20)).toEqual([{ unit: "day", value: 1 }])
		// a running clock keeps its zeros
		expect(durationParts(3600, true)).toEqual([
			{ unit: "hour", value: 1 },
			{ unit: "minute", value: 0 },
			{ unit: "second", value: 0 },
		])
	})

	it("rounds rough figures to whole minutes", () => {
		expect(durationParts(roughSeconds(182))).toEqual([
			{ unit: "minute", value: 3 },
		])
		expect(roughSeconds(1.3)).toBe(1.3)
	})

	it("measures negative durations as positive and drops the unmeasurable", () => {
		expect(durationParts(-499)).toEqual(durationParts(499))
		expect(durationParts(Number.NaN)).toEqual([])
	})
})

describe("formatDuration", () => {
	it("is written per language and reading level", () => {
		const en = createI18n({ locale: "en" })
		const de = createI18n({ locale: "de" })
		const enSimple = createI18n({ locale: "en", readingLevel: "simple" })
		const deSimple = createI18n({ locale: "de", readingLevel: "simple" })
		expect(formatDuration(499, en)).toBe("8 min 19 s")
		expect(formatDuration(499, de)).toBe("8 Min. 19 s")
		expect(formatDuration(1.28, de)).toBe("1,3 s")
		expect(formatDuration(499, enSimple)).toBe("8 minutes and 19 seconds")
		expect(formatDuration(499, deSimple)).toBe("8 Minuten und 19 Sekunden")
		expect(formatDuration(1.28, enSimple)).toBe("1.3 seconds")
		expect(formatDuration(4 * 3600 + 10 * 60 + 12, en, true)).toBe(
			"4 h 10 min 12 s",
		)
		expect(formatDuration(4 * 3600 + 10 * 60 + 12, deSimple, true)).toBe(
			"4 Stunden, 10 Minuten und 12 Sekunden",
		)
		expect(formatDuration(26_000 * YEAR, en)).toBe("26,000 years")
		expect(formatDuration(26_000 * YEAR, de)).toBe("26.000 Jahre")
		expect(formatDuration(1 * YEAR + 1, en)).toBe("1 year")
	})
})

describe("pulse targets and arrivals", () => {
	it("times the Sun and the planets, and the Moon for a flash from Earth", () => {
		expect(pulseTargetIds("sun")).toEqual([
			"mercury",
			"venus",
			"earth",
			"mars",
			"jupiter",
			"saturn",
			"uranus",
			"neptune",
		])
		expect(pulseTargetIds("earth")).toContain("moon")
		expect(pulseTargetIds("earth")).toContain("sun")
		expect(pulseTargetIds("earth")).not.toContain("earth")
		expect(pulseTargetIds("mars")).not.toContain("moon")
		expect(LIGHT_BODY_IDS).toContain("moon")
	})

	it("announces them in order of arrival, with the classic numbers", () => {
		const arrivals = pulseArrivals({ emitterId: "sun", emitJD: JD })
		expect(arrivals.map((a) => a.id)).toEqual(pulseTargetIds("sun"))
		const seconds = Object.fromEntries(arrivals.map((a) => [a.id, a.seconds]))
		expect(seconds.mercury / 60).toBeGreaterThan(2.5)
		expect(seconds.mercury / 60).toBeLessThan(4)
		expect(seconds.earth).toBeGreaterThan(490)
		expect(seconds.earth).toBeLessThan(508)
		expect(seconds.neptune / 3600).toBeGreaterThan(4)
		for (const arrival of arrivals) {
			expect(arrival.jd).toBeCloseTo(JD + arrival.seconds / 86400, 9)
		}
	})

	it("reaches the Moon first from Earth, in about 1.3 s", () => {
		const [first] = pulseArrivals({ emitterId: "earth", emitJD: JD })
		expect(first.id).toBe("moon")
		expect(first.seconds).toBeGreaterThan(1.2)
		expect(first.seconds).toBeLessThan(1.37)
	})

	it("is empty for an unknown source", () => {
		expect(pulseArrivals({ emitterId: "pluto", emitJD: JD })).toEqual([])
	})
})

describe("signalDelay", () => {
	it("gives the live delay to Mars inside its 3 to 22 minute range", () => {
		const delay = signalDelay("earth", "mars", JD)!
		expect(delay.seconds).toBeGreaterThanOrEqual(delay.minSeconds)
		expect(delay.seconds).toBeLessThanOrEqual(delay.maxSeconds)
		expect(delay.minSeconds / 60).toBeCloseTo(3, 0)
		expect(delay.maxSeconds / 60).toBeCloseTo(22.3, 0)
		// the delay changes as the planets move
		const later = signalDelay("earth", "mars", JD + 200)!
		expect(Math.abs(later.seconds - delay.seconds)).toBeGreaterThan(60)
	})

	it("works for any body, moons of other planets included", () => {
		expect(signalDelay("earth", "io", JD)!.seconds / 60).toBeGreaterThan(30)
		expect(signalDelay("earth", "earth", JD)).toBeNull()
		expect(signalDelay("earth", "pluto", JD)).toBeNull()
	})
})

describe("beyond the solar system", () => {
	it("names the nearest star, the galactic centre and Andromeda in light-years", () => {
		expect(BEYOND.map((place) => place.id)).toEqual([
			"proximaCentauri",
			"galacticCentre",
			"andromeda",
		])
		expect(formatDuration(BEYOND[0].lightYears * YEAR, createI18n())).toBe(
			"4.2 years",
		)
	})
})
