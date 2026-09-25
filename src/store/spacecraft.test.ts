import { beforeEach, describe, expect, it } from "vitest"

import { useSimStore } from "./sim"
import { useSpacecraftStore } from "./spacecraft"

describe("spacecraft store", () => {
	beforeEach(() => {
		useSimStore.getState().reset()
		useSpacecraftStore.setState({
			showSpacecraft: true,
			showAllPaths: false,
			selectedCraftId: null,
			hoverCraftId: null,
		})
	})

	it("shows the layer by default, with only the chosen craft's path", () => {
		const state = useSpacecraftStore.getState()
		expect(state.showSpacecraft).toBe(true)
		expect(state.showAllPaths).toBe(false)
	})

	it("selecting a craft clears the body selection", () => {
		useSimStore.getState().select("mars")
		useSpacecraftStore.getState().selectCraft("voyager1")
		expect(useSimStore.getState().selectedId).toBeNull()
		expect(useSpacecraftStore.getState().selectedCraftId).toBe("voyager1")
	})

	it("choosing a body clears the craft selection", () => {
		useSpacecraftStore.getState().selectCraft("voyager1")
		useSimStore.getState().setFocus("jupiter")
		expect(useSpacecraftStore.getState().selectedCraftId).toBeNull()
		expect(useSimStore.getState().selectedId).toBe("jupiter")
	})

	it("the way out (home button, Escape) clears the craft selection", () => {
		useSpacecraftStore.getState().selectCraft("juno")
		useSimStore.getState().reset()
		expect(useSpacecraftStore.getState().selectedCraftId).toBeNull()
	})

	it("flying to a point or a planet keeps the craft selected", () => {
		useSpacecraftStore.getState().selectCraft("juno")
		useSimStore
			.getState()
			.goTo({ kind: "point", anchorId: "jupiter", offsetKm: [1e6, 0, 0] })
		useSimStore.getState().focus("jupiter")
		expect(useSpacecraftStore.getState().selectedCraftId).toBe("juno")
	})

	it("hiding the layer drops the selection and the hover", () => {
		useSpacecraftStore.getState().selectCraft("juno")
		useSpacecraftStore.getState().setHoverCraft("jwst")
		useSpacecraftStore.getState().setShowSpacecraft(false)
		const state = useSpacecraftStore.getState()
		expect(state.selectedCraftId).toBeNull()
		expect(state.hoverCraftId).toBeNull()
	})
})
