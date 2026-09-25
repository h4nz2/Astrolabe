/** A guided tour in the link (#28): `?tour=<id>&stop=<n>&autoplay=true`. */
import { describe, expect, it } from "vitest"

import { J2000_JD } from "@/sim"

import { OVERVIEW } from "./navigation"
import { simSearchSchema } from "./simSearch"
import { tourSearch } from "./tour"
import { sameSearch, searchFromState } from "./urlSync"

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
	showOrbitLabels: false,
	...partial,
})

const tour = { id: "grandTour", order: 1, stops: [] }
const listed = (id: string) => id === "grandTour"

describe("tourSearch", () => {
	it("names the tour and the stop counted from 1", () => {
		expect(tourSearch({ tour, index: 2, auto: false }, listed)).toEqual({
			tour: "grandTour",
			stop: 3,
			autoplay: undefined,
		})
		expect(tourSearch({ tour, index: 0, auto: true }, listed)).toMatchObject({
			autoplay: true,
		})
	})

	it("is empty without a tour, or for a tour that is not in the menu", () => {
		expect(tourSearch({ tour: null, index: 0, auto: false }, listed)).toEqual(
			{},
		)
		expect(
			tourSearch(
				{ tour: { ...tour, id: "intro" }, index: 0, auto: false },
				listed,
			),
		).toEqual({})
	})
})

describe("the tour in the URL", () => {
	it("is written with the rest of the view and compared", () => {
		const search = searchFromState(
			state({ tour: { tour: "grandTour", stop: 3, autoplay: true } }),
			{},
		)
		expect(search).toMatchObject({ tour: "grandTour", stop: 3, autoplay: true })
		expect(sameSearch(search, { ...search, stop: 4 })).toBe(false)
		expect(sameSearch(search, { ...search, tour: undefined })).toBe(false)
		expect(sameSearch(search, { ...search, autoplay: undefined })).toBe(false)
		expect(searchFromState(state(), {}).tour).toBeUndefined()
	})

	it("parses, dropping stops that are not whole positive numbers", () => {
		expect(
			simSearchSchema.parse({ tour: "howBig", stop: "4", autoplay: true }),
		).toMatchObject({ tour: "howBig", stop: 4, autoplay: true })
		for (const stop of ["0", "-1", "2.5", "", "x"]) {
			expect(simSearchSchema.parse({ stop }).stop).toBeUndefined()
		}
	})
})
