import { describe, expect, it } from "vitest"

import { J2000_JD, jdToDate } from "@/sim"

import { formatAu, formatNumber, formatUTC } from "./format"

describe("formatUTC", () => {
	it("prints an ISO-like UTC date to the minute", () => {
		expect(formatUTC(new Date(Date.UTC(2026, 8, 24, 10, 35, 59)))).toBe(
			"2026-09-24 10:35 UTC",
		)
		expect(formatUTC(jdToDate(J2000_JD))).toBe("2000-01-01 12:00 UTC")
	})

	it("keeps the sign and digits of far years", () => {
		expect(formatUTC(new Date(Date.UTC(-500, 0, 1)))).toBe(
			"-0500-01-01 00:00 UTC",
		)
		expect(formatUTC(new Date(Date.UTC(12345, 11, 31, 23, 59)))).toBe(
			"12345-12-31 23:59 UTC",
		)
	})

	it("shows a dash for a Date out of range", () => {
		expect(formatUTC(new Date(Number.NaN))).toBe("—")
	})
})

describe("formatNumber", () => {
	it("adds thousands separators and scales the decimals with the magnitude", () => {
		expect(formatNumber(149598261)).toBe("149,598,261")
		expect(formatNumber(6371.0084)).toBe("6,371")
		expect(formatNumber(365.256)).toBe("365.3")
		expect(formatNumber(27.3217)).toBe("27.32")
		expect(formatNumber(0.29478)).toBe("0.295")
		expect(formatNumber(-5832.5)).toBe("-5,833")
	})

	it("shows a dash for non-finite values", () => {
		expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("—")
	})
})

describe("formatAu", () => {
	it("keeps 4 significant digits", () => {
		expect(formatAu(1)).toBe("1")
		expect(formatAu(5.20336301)).toBe("5.203")
		expect(formatAu(0.0025695)).toBe("0.00257")
	})
})
