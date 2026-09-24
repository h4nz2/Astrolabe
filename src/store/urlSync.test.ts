import { describe, expect, it } from "vitest"

import { J2000_JD, dateToJD } from "@/sim"

import { simSearchSchema } from "./simSearch"
import {
	TIME_SYNC_MAX_WARP,
	mountState,
	roundJD,
	sameSearch,
	searchFromState,
	shouldMirrorTime,
	stateFromSearch,
} from "./urlSync"

describe("simSearchSchema", () => {
	it("accepts the mirrored params and coerces numeric strings", () => {
		expect(
			simSearchSchema.parse({ focus: "io", t: "2451545.1234", warp: "60" }),
		).toEqual({ focus: "io", t: 2451545.1234, warp: 60 })
		expect(simSearchSchema.parse({ t: 2451545, warp: 3600 })).toEqual({
			t: 2451545,
			warp: 3600,
		})
		expect(simSearchSchema.parse({ warp: 3.7 }).warp).toBe(3.7)
		expect(simSearchSchema.parse({})).toEqual({})
	})

	it("drops invalid values instead of failing the whole search", () => {
		expect(simSearchSchema.parse({ focus: 42, t: "abc", warp: "x" })).toEqual({
			focus: undefined,
			t: undefined,
			warp: undefined,
		})
		expect(simSearchSchema.parse({ t: "Infinity", warp: 0 })).toEqual({
			t: undefined,
			warp: undefined,
		})
		expect(simSearchSchema.parse({ focus: "planet-x" }).focus).toBe("planet-x")
	})

	it("accepts a negative warp (the clock running backwards) but not 0", () => {
		expect(simSearchSchema.parse({ warp: "-86400" }).warp).toBe(-86400)
		expect(simSearchSchema.parse({ warp: -1 }).warp).toBe(-1)
		expect(simSearchSchema.parse({ warp: "0" }).warp).toBeUndefined()
		expect(simSearchSchema.parse({ warp: "-0" }).warp).toBeUndefined()
	})

	it("treats blank and non-numeric values as absent, never as 0", () => {
		// `?t=` and `?t=%20` reach the schema as "" and " "; `?t=null` / `?t=true` as null / true
		for (const value of ["", " ", null, true, false, {}, []]) {
			expect(simSearchSchema.parse({ t: value, warp: value })).toEqual({
				t: undefined,
				warp: undefined,
			})
		}
	})
})

describe("urlSync helpers", () => {
	it("rounds Julian Dates to 4 decimals", () => {
		expect(roundJD(2451545.123456789)).toBe(2451545.1235)
		expect(roundJD(J2000_JD)).toBe(J2000_JD)
	})

	it("mirrors time only while paused or at a slow warp", () => {
		expect(shouldMirrorTime(false, 1)).toBe(true)
		expect(shouldMirrorTime(false, TIME_SYNC_MAX_WARP)).toBe(true)
		expect(shouldMirrorTime(false, 3600)).toBe(false)
		expect(shouldMirrorTime(true, 31557600)).toBe(true)
		// backwards counts by its speed
		expect(shouldMirrorTime(false, -TIME_SYNC_MAX_WARP)).toBe(true)
		expect(shouldMirrorTime(false, -3600)).toBe(false)
	})

	it("builds the search from the store, omitting the defaults", () => {
		expect(
			searchFromState(
				{ focusId: "sun", timeWarp: 1, paused: false, simTimeJD: J2000_JD },
				{},
			),
		).toEqual({ focus: undefined, t: J2000_JD, warp: undefined })
		expect(
			searchFromState(
				{
					focusId: "io",
					timeWarp: 60,
					paused: false,
					simTimeJD: 2451545.123456,
				},
				{},
			),
		).toEqual({ focus: "io", t: 2451545.1235, warp: 60 })
	})

	it("keeps the last written t while the clock runs too fast to mirror", () => {
		const previous = { focus: "io", t: 2451545.5, warp: 60 }
		expect(
			searchFromState(
				{ focusId: "mars", timeWarp: 86400, paused: false, simTimeJD: 2460000 },
				previous,
			),
		).toEqual({ focus: "mars", t: 2451545.5, warp: 86400 })
		// pausing pins the current time again
		expect(
			searchFromState(
				{ focusId: "mars", timeWarp: 86400, paused: true, simTimeJD: 2460000 },
				previous,
			).t,
		).toBe(2460000)
	})

	it("writes a non-integer warp as it is, so a link runs at the speed it was taken at", () => {
		const mirrored = (timeWarp: number) =>
			searchFromState(
				{ focusId: "sun", timeWarp, paused: true, simTimeJD: J2000_JD },
				{},
			)
		expect(mirrored(59.6).warp).toBe(59.6)
		expect(mirrored(3.7).warp).toBe(3.7)
		expect(mirrored(0.5).warp).toBe(0.5)
		// the round trip through the schema and back into the store is exact
		for (const warp of [3.7, 0.5]) {
			const parsed = simSearchSchema.parse(mirrored(warp))
			expect(stateFromSearch(parsed).timeWarp).toBe(warp)
		}
		// a reversed clock is shared as it is; only 0 (rejected by the schema) is left out
		expect(mirrored(-60).warp).toBe(-60)
		expect(stateFromSearch(simSearchSchema.parse(mirrored(-60))).timeWarp).toBe(
			-60,
		)
		expect(mirrored(0).warp).toBeUndefined()
	})

	it("compares searches field by field", () => {
		expect(
			sameSearch(
				{ focus: "io", t: 1, warp: 2 },
				{ focus: "io", t: 1, warp: 2 },
			),
		).toBe(true)
		expect(sameSearch({}, { focus: undefined })).toBe(true)
		expect(sameSearch({ t: 1 }, { t: 1.0001 })).toBe(false)
	})

	it("seeds the store from the search, skipping unknown bodies and absent params", () => {
		expect(stateFromSearch({})).toEqual({})
		expect(stateFromSearch({ focus: "planet-x" })).toEqual({})
		expect(stateFromSearch({ focus: "io", t: J2000_JD, warp: 3600 })).toEqual({
			focusId: "io",
			simTimeJD: J2000_JD,
			timeWarp: 3600,
		})
	})

	it("seeds the wall clock on mount when the URL carries no t", () => {
		const now = new Date("2026-09-24T12:00:00Z")
		expect(mountState({}, now)).toEqual({ simTimeJD: dateToJD(now) })
		expect(mountState({ focus: "io", warp: 60 }, now)).toEqual({
			focusId: "io",
			timeWarp: 60,
			simTimeJD: dateToJD(now),
		})
		// an explicit t wins
		expect(mountState({ t: J2000_JD }, now)).toEqual({ simTimeJD: J2000_JD })
		// without a clock argument it is the real wall clock
		const before = dateToJD(new Date())
		const seeded = mountState({}).simTimeJD
		expect(seeded).toBeGreaterThanOrEqual(before)
		expect(seeded).toBeLessThanOrEqual(dateToJD(new Date()))
	})
})
