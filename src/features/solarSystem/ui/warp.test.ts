import { describe, expect, it } from "vitest"

import { createI18n } from "@/i18n"
import { WARP_PRESETS } from "@/store/sim"

import {
	directionOf,
	stepWarp,
	warpLabel,
	warpParts,
	withDirection,
} from "./warp"

const values = WARP_PRESETS

describe("stepWarp", () => {
	it("walks the presets and stops at the ends", () => {
		expect(stepWarp(1, 1)).toBe(60)
		expect(stepWarp(60, -1)).toBe(1)
		expect(stepWarp(values[values.length - 1], 1)).toBe(
			values[values.length - 1],
		)
		expect(stepWarp(1, -1)).toBe(1)
	})

	it("snaps a non-preset warp to the next preset in the pressed direction", () => {
		expect(stepWarp(100, 1)).toBe(3600)
		expect(stepWarp(100, -1)).toBe(60)
		expect(stepWarp(0.5, -1)).toBe(0.5)
	})

	it("keeps a reversed clock reversed and steps its speed", () => {
		expect(stepWarp(-86400, 1)).toBe(-604800)
		expect(stepWarp(-86400, -1)).toBe(-3600)
		expect(stepWarp(-1, -1)).toBe(-1)
		expect(stepWarp(-100, 1)).toBe(-3600)
	})
})

describe("direction", () => {
	it("reads and flips the direction without changing the speed", () => {
		expect(directionOf(86400)).toBe(1)
		expect(directionOf(-86400)).toBe(-1)
		expect(directionOf(0)).toBe(1)
		expect(withDirection(86400, -1)).toBe(-86400)
		expect(withDirection(-86400, -1)).toBe(-86400)
		expect(withDirection(-86400, 1)).toBe(86400)
	})
})

describe("warpParts", () => {
	it("names a warp in the largest whole unit per second", () => {
		expect(warpParts(1)).toEqual({ kind: "realTime" })
		expect(warpParts(86400)).toEqual({ kind: "unit", unit: "day", count: 1 })
		expect(warpParts(120)).toEqual({ kind: "unit", unit: "minute", count: 2 })
		expect(warpParts(-604800)).toEqual({
			kind: "unit",
			unit: "week",
			count: -1,
		})
		expect(warpParts(100)).toEqual({ kind: "factor", factor: 100 })
		expect(warpParts(0)).toEqual({ kind: "factor", factor: 0 })
	})
})

describe("warpLabel", () => {
	const en = createI18n({ locale: "en" })
	const de = createI18n({ locale: "de" })

	it("labels every preset in English", () => {
		expect(WARP_PRESETS.map((value) => warpLabel(value, en))).toEqual([
			"1x",
			"1 min/s",
			"1 h/s",
			"1 day/s",
			"1 week/s",
			"1 month/s",
			"1 year/s",
			"10 years/s",
		])
	})

	it("translates and pluralises", () => {
		expect(warpLabel(86400, de)).toBe("1 Tag/s")
		expect(warpLabel(2 * 86400, de)).toBe("2 Tage/s")
		expect(warpLabel(2 * 86400, en)).toBe("2 days/s")
		expect(warpLabel(31557600, de)).toBe("1 Jahr/s")
	})

	it("formats a bare factor for the locale", () => {
		expect(warpLabel(1234, en)).toBe("1,234x")
		expect(warpLabel(1234, de)).toBe("1.234x")
		expect(warpLabel(12345, de)).toBe("12.345x")
	})
})
