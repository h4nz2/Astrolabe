import { describe, expect, it } from "vitest"

import { J2000_JD } from "@/sim"

import { OVERVIEW } from "./navigation"
import { simSearchSchema } from "./simSearch"
import { sameSearch, scaleFromSearch, searchFromState } from "./urlSync"

type Mirrored = Parameters<typeof searchFromState>[0]

const state = (partial: Partial<Mirrored> = {}): Mirrored => ({
	view: OVERVIEW,
	selectedId: null,
	shot: null,
	timeWarp: 1,
	paused: true,
	simTimeJD: J2000_JD,
	showOrbits: true,
	showLabels: true,
	showMoons: true,
	showMarkers: true,
	...partial,
})

describe("the scale preset in the URL (#21)", () => {
	it("is written only when it is not the default", () => {
		expect(searchFromState(state(), {}).scale).toBeUndefined()
		expect(
			searchFromState(state({ scalePreset: "everythingVisible" }), {}).scale,
		).toBeUndefined()
		expect(searchFromState(state({ scalePreset: null }), {}).scale).toBe(
			undefined,
		)
		expect(searchFromState(state({ scalePreset: "trueScale" }), {}).scale).toBe(
			"trueScale",
		)
		expect(sameSearch({ scale: "textbook" }, {})).toBe(false)
	})

	it("opens a link in its preset, and anything else in Everything visible", () => {
		for (const id of [
			"trueScale",
			"textbook",
			"bigPlanets",
			"everythingVisible",
		] as const) {
			const search = simSearchSchema.parse(
				searchFromState(state({ scalePreset: id }), {}),
			)
			expect(scaleFromSearch(search)).toBe(id)
		}
		expect(scaleFromSearch({})).toBe("everythingVisible")
		expect(scaleFromSearch(simSearchSchema.parse({ scale: "tiny" }))).toBe(
			"everythingVisible",
		)
		expect(scaleFromSearch(simSearchSchema.parse({ scale: 3 }))).toBe(
			"everythingVisible",
		)
		expect(scaleFromSearch(simSearchSchema.parse({ scale: "toString" }))).toBe(
			"everythingVisible",
		)
	})
})
