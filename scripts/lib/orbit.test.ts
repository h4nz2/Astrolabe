import { describe, expect, it } from "vitest"

import { densityKgPerM3, laplaceRadiusKm, periodDaysFromKepler } from "./orbit"

const relativeError = (actual: number, expected: number): number =>
	Math.abs(actual - expected) / expected

describe("periodDaysFromKepler", () => {
	it("recovers Titan's period from Saturn's mass", () => {
		const period = periodDaysFromKepler(1221870, 5.68336e26)
		expect(relativeError(period, 15.945)).toBeLessThan(0.005)
	})

	it("recovers Io's period from Jupiter's mass", () => {
		const period = periodDaysFromKepler(421800, 1.89819e27)
		expect(relativeError(period, 1.76914)).toBeLessThan(0.005)
	})

	it("is close for the Moon even though its own mass is not negligible", () => {
		const period = periodDaysFromKepler(384400, 5.97237e24)
		expect(relativeError(period, 27.3217)).toBeLessThan(0.01)
	})

	it("rejects non-positive input", () => {
		expect(() => periodDaysFromKepler(0, 1e24)).toThrow(RangeError)
		expect(() => periodDaysFromKepler(1000, 0)).toThrow(RangeError)
	})
})

describe("laplaceRadiusKm", () => {
	it("puts Saturn's transition near 2.2 million km: Titan inside, Iapetus outside", () => {
		const rL = laplaceRadiusKm(
			0.016298,
			60268,
			1426666414,
			0.05386179,
			5.68336e26,
			1.989e30,
		)
		expect(rL).toBeGreaterThan(2.1e6)
		expect(rL).toBeLessThan(2.3e6)
		expect(1221870).toBeLessThan(rL) // Titan
		expect(3560854).toBeGreaterThan(rL) // Iapetus
	})

	it("scales with the fifth root of J2 R^2 a^3 M", () => {
		const base = laplaceRadiusKm(0.01, 1000, 1e8, 0, 1e26, 1e30)
		expect(laplaceRadiusKm(0.01 * 32, 1000, 1e8, 0, 1e26, 1e30)).toBeCloseTo(
			2 * base,
			6,
		)
		expect(laplaceRadiusKm(0.01, 1000, 1e8, 0, 1e26, 1e30 / 32)).toBeCloseTo(
			2 * base,
			6,
		)
	})

	it("rejects unusable inputs", () => {
		expect(() => laplaceRadiusKm(0, 1000, 1e8, 0, 1e26, 1e30)).toThrow(
			RangeError,
		)
		expect(() => laplaceRadiusKm(0.01, 1000, 1e8, 1, 1e26, 1e30)).toThrow(
			RangeError,
		)
		expect(() => laplaceRadiusKm(0.01, 1000, 1e8, 0, 1e26, 0)).toThrow(
			RangeError,
		)
	})
})

describe("densityKgPerM3", () => {
	it("gives the Earth about 5500 kg/m3 and a 1 kg, 1 km sphere next to nothing", () => {
		expect(densityKgPerM3(5.97237e24, 6371.0084)).toBeCloseTo(5513, -1)
		expect(densityKgPerM3(1, 1)).toBeCloseTo(2.39e-10, 12)
	})
})
