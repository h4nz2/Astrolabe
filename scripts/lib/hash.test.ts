import { describe, expect, it } from "vitest"

import { fnv1a32, hashToDegrees, spreadPhases } from "./hash"

describe("fnv1a32", () => {
	it("matches the reference 32-bit FNV-1a vectors", () => {
		expect(fnv1a32("")).toBe(0x811c9dc5)
		expect(fnv1a32("a")).toBe(0xe40c292c)
		expect(fnv1a32("foobar")).toBe(0xbf9cf968)
	})
})

describe("hashToDegrees", () => {
	it("maps into [0, 360) with three decimals", () => {
		for (const input of ["io", "europa", "s2003j24", "", "x".repeat(100)]) {
			const degrees = hashToDegrees(input)
			expect(degrees).toBeGreaterThanOrEqual(0)
			expect(degrees).toBeLessThan(360)
			expect(Math.round(degrees * 1000) / 1000).toBe(degrees)
		}
	})
})

describe("spreadPhases", () => {
	const ids = [
		"moon",
		"phobos",
		"deimos",
		"io",
		"europa",
		"ganymede",
		"callisto",
		"titan",
		"rhea",
		"triton",
		...Array.from({ length: 40 }, (_, i) => `s2004s${i}`),
	]

	it("is deterministic for the same id", () => {
		for (const id of ids) expect(spreadPhases(id)).toEqual(spreadPhases(id))
		expect(spreadPhases("io")).toEqual({
			meanAnomalyDeg: hashToDegrees("io:meanAnomaly"),
			argPeriapsisDeg: hashToDegrees("io:argPeriapsis"),
			longAscNodeDeg: hashToDegrees("io:longAscNode"),
		})
	})

	it("keeps every angle within [0, 360)", () => {
		for (const id of ids) {
			for (const angle of Object.values(spreadPhases(id))) {
				expect(angle).toBeGreaterThanOrEqual(0)
				expect(angle).toBeLessThan(360)
			}
		}
	})

	it("spreads different bodies apart instead of lining them up", () => {
		const anomalies = ids.map((id) => spreadPhases(id).meanAnomalyDeg)
		expect(new Set(anomalies).size).toBe(ids.length)
		const sorted = [...anomalies].sort((a, b) => a - b)
		// with 50 ids in 360 degrees, at least one pair should sit in each half
		expect(sorted[0]).toBeLessThan(180)
		expect(sorted[sorted.length - 1]).toBeGreaterThan(180)
		const io = spreadPhases("io")
		expect(io.meanAnomalyDeg).not.toBe(io.argPeriapsisDeg)
		expect(io.meanAnomalyDeg).not.toBe(io.longAscNodeDeg)
	})
})
