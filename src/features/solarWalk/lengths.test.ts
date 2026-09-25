import { describe, expect, it } from "vitest"

import {
	formatLength,
	formatScaleDenominator,
	formatTrueKm,
	readableLength,
	roundCount,
	roundHours,
	roundMinutes,
	roundReadable,
} from "./lengths"

describe("roundReadable", () => {
	it("keeps two significant digits below 10 and from 1000, whole numbers between", () => {
		expect(roundReadable(2.2091)).toBe(2.2)
		expect(roundReadable(0.8412)).toBeCloseTo(0.84, 10)
		expect(roundReadable(25.78)).toBe(26)
		expect(roundReadable(134.3)).toBe(134)
		expect(roundReadable(775.2)).toBe(775)
		expect(roundReadable(6923)).toBe(6900)
		expect(roundReadable(9.99)).toBe(10)
		expect(roundReadable(0)).toBe(0)
	})
})

describe("readableLength", () => {
	it("picks the unit a ruler or a map would use", () => {
		expect(readableLength(0.0022)).toEqual({ value: 2.2, unit: "millimeter" })
		expect(readableLength(0.00084)).toEqual({ value: 0.84, unit: "millimeter" })
		expect(readableLength(0.0663)).toEqual({ value: 6.6, unit: "centimeter" })
		expect(readableLength(0.241)).toEqual({ value: 24, unit: "centimeter" })
		expect(readableLength(25.78)).toEqual({ value: 26, unit: "meter" })
		expect(readableLength(3230)).toEqual({ value: 3.2, unit: "kilometer" })
		expect(readableLength(6.923e6)).toEqual({ value: 6900, unit: "kilometer" })
	})

	it("moves up a unit when rounding reaches it", () => {
		expect(readableLength(999.6)).toEqual({ value: 1, unit: "kilometer" })
		expect(readableLength(0.0099999)).toEqual({ value: 1, unit: "centimeter" })
	})
})

describe("formatting", () => {
	it("formats lengths in the locale's style", () => {
		expect(formatLength(0.0022, "en")).toBe("2.2 mm")
		expect(formatLength(0.0022, "de")).toBe("2,2 mm")
		expect(formatLength(25.78, "en")).toBe("26 m")
		expect(formatLength(6.923e6, "en")).toBe("6,900 km")
		expect(formatLength(6.923e6, "de")).toBe("6.900 km")
	})

	it("says large true numbers in words", () => {
		expect(formatTrueKm(12742, "en")).toBe("12,742 km")
		expect(formatTrueKm(149598261, "en")).toBe("149.6 million km")
		expect(formatTrueKm(149598261, "de")).toBe("149,6 Millionen km")
		expect(formatScaleDenominator(5.796e9, "en")).toBe("5.8 billion")
		expect(formatScaleDenominator(5.796e9, "de")).toBe("5,8 Milliarden")
	})

	it("rounds flight hours, walking minutes and landmark counts", () => {
		expect(roundHours(7.69)).toBe(7.5)
		expect(roundHours(2.56)).toBe(2.5)
		expect(roundHours(0.1)).toBe(0.5)
		expect(roundHours(32.1)).toBe(32)
		expect(roundMinutes(11.6)).toBe(12)
		expect(roundMinutes(0.2)).toBe(1)
		expect(roundCount(0.095)).toBe(0.1)
		expect(roundCount(7.38)).toBe(7.4)
		expect(roundCount(30.8)).toBe(31)
	})
})
