import { describe, expect, it } from "vitest"

import { parseMass, parseNumber } from "./numbers"

describe("parseMass", () => {
	it("reads the API {massValue, massExponent} objects", () => {
		expect(parseMass({ massValue: 5.97237, massExponent: 24 })).toBe(5.97237e24)
		expect(parseMass({ massValue: 1.4762, massExponent: 15 })).toBe(1.4762e15)
	})

	it("reads the curated 'value * 10^exponent' strings", () => {
		expect(parseMass("4.799844 * 10^22")).toBe(4.799844e22)
		expect(parseMass("1.075938 * 10^23")).toBe(1.075938e23)
		expect(parseMass("13 * 10^16")).toBe(1.3e17)
		expect(parseMass("0.0015 * 10^16")).toBe(1.5e13)
		expect(parseMass("617449 * 10^15")).toBe(6.17449e20)
	})

	it("tolerates other multiplication signs and e-notation", () => {
		expect(parseMass("2.14×10^22")).toBe(2.14e22)
		expect(parseMass("2.14 x 10^22")).toBe(2.14e22)
		expect(parseMass("4.8e22")).toBe(4.8e22)
		expect(parseMass("5E24")).toBe(5e24)
		expect(parseMass("1.5")).toBe(1.5)
	})

	it("accepts plain positive numbers", () => {
		expect(parseMass(1.4762e15)).toBe(1.4762e15)
	})

	it("returns null for missing, malformed or non-positive values", () => {
		for (const value of [
			null,
			undefined,
			"",
			"   ",
			"heavy",
			"10^22 kg",
			"1.5 * 10^",
			0,
			-1,
			Number.NaN,
			"0 * 10^22",
			"-4.8e22",
			{ massValue: null, massExponent: 22 },
			{ massValue: 1, massExponent: 1.5 },
			{ massValue: "1", massExponent: 22 },
			[],
			true,
		]) {
			expect(parseMass(value), JSON.stringify(value)).toBeNull()
		}
	})
})

describe("parseNumber", () => {
	it("reads numbers and numeric strings, including a unicode minus", () => {
		expect(parseNumber(3)).toBe(3)
		expect(parseNumber(-640.38)).toBe(-640.38)
		expect(parseNumber("-640.38")).toBe(-640.38)
		expect(parseNumber("−763.95")).toBe(-763.95)
		expect(parseNumber("–1283.4")).toBe(-1283.4)
		expect(parseNumber(" 1.25 ")).toBe(1.25)
		expect(parseNumber("1 992.8")).toBe(1992.8)
	})

	it("returns null for anything that is not a finite number", () => {
		for (const value of [
			null,
			undefined,
			"",
			"abc",
			Number.NaN,
			Infinity,
			{},
			[],
		]) {
			expect(parseNumber(value), JSON.stringify(value)).toBeNull()
		}
	})
})
