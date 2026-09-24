import { describe, expect, it } from "vitest"

import {
	AU_KM,
	KM_PER_UNIT,
	SECONDS_PER_DAY,
	auToKm,
	kmToAu,
	toKm,
	toUnits,
} from "./units"

describe("units", () => {
	it("uses 1000 km per scene unit", () => {
		expect(KM_PER_UNIT).toBe(1000)
		expect(toUnits(1000)).toBe(1)
		expect(toUnits(149597870.7)).toBeCloseTo(149597.8707, 9)
		expect(toKm(1)).toBe(1000)
	})

	it("round-trips km <-> units and km <-> AU", () => {
		for (const km of [0, 1, 6371, 384400, 4.5e9]) {
			expect(toKm(toUnits(km))).toBeCloseTo(km, 6)
			expect(auToKm(kmToAu(km))).toBeCloseTo(km, 6)
		}
		expect(auToKm(1)).toBe(AU_KM)
	})

	it("has the IAU constants", () => {
		expect(AU_KM).toBe(149597870.7)
		expect(SECONDS_PER_DAY).toBe(86400)
	})
})
