/** The "Small bodies" layer (#23): hidden by default, shown with the switch or by focusing one. */
import { describe, expect, it } from "vitest"

import { getBody } from "@/data"

import { isBodyShown, useSimStore } from "./sim"
import { layersFromSearch, searchFromState } from "./urlSync"

const base = {
	showMoons: true,
	showAllMoons: false,
	showSmallBodies: false,
	focusId: "sun",
}

describe("the small bodies layer", () => {
	it("is off by default and hides dwarf planets, asteroids, comets and their moons", () => {
		expect(useSimStore.getState().showSmallBodies).toBe(false)
		for (const id of ["pluto", "charon", "vesta", "halley"]) {
			expect(isBodyShown(getBody(id), base), id).toBe(false)
		}
		for (const id of ["sun", "earth", "moon", "io"]) {
			expect(isBodyShown(getBody(id), base), id).toBe(true)
		}
	})

	it("shows them all when switched on, moons still following the moons switch", () => {
		const on = { ...base, showSmallBodies: true }
		for (const id of ["pluto", "charon", "vesta", "halley"]) {
			expect(isBodyShown(getBody(id), on), id).toBe(true)
		}
		expect(isBodyShown(getBody("charon"), { ...on, showMoons: false })).toBe(
			false,
		)
	})

	it("always shows the focused small body's own system, and nothing else", () => {
		for (const focusId of ["pluto", "charon"]) {
			const state = { ...base, focusId }
			expect(isBodyShown(getBody("pluto"), state), focusId).toBe(true)
			expect(isBodyShown(getBody("charon"), state), focusId).toBe(true)
			// Charon is featured (#17); Pluto's small moons are the long tail
			expect(isBodyShown(getBody("nix"), state), focusId).toBe(false)
			expect(
				isBodyShown(getBody("nix"), { ...state, showAllMoons: true }),
				focusId,
			).toBe(true)
			expect(isBodyShown(getBody("eris"), state), focusId).toBe(false)
			expect(isBodyShown(getBody("halley"), state), focusId).toBe(false)
		}
		expect(isBodyShown(getBody("halley"), { ...base, focusId: "halley" })).toBe(
			true,
		)
	})

	it("is carried by a link only while on", () => {
		const state = {
			...useSimStore.getState(),
			scalePreset: null,
		}
		expect(searchFromState(state, {}).smallBodies).toBeUndefined()
		expect(
			searchFromState({ ...state, showSmallBodies: true }, {}).smallBodies,
		).toBe(true)
		expect(layersFromSearch({}).showSmallBodies).toBe(false)
		expect(layersFromSearch({ smallBodies: true }).showSmallBodies).toBe(true)
		useSimStore.getState().setShowSmallBodies(true)
		expect(useSimStore.getState().showSmallBodies).toBe(true)
		useSimStore.getState().setShowSmallBodies(false)
	})
})
