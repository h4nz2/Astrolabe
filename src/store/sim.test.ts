import { afterEach, describe, expect, it } from "vitest"

import { J2000_JD, dateToJD } from "@/sim"

import { WARP_PRESETS, isBodyShown, useSimStore } from "./sim"

const reset = () => useSimStore.setState(useSimStore.getInitialState(), true)

afterEach(reset)

describe("sim store", () => {
	it("starts at the wall clock, 1x, playing, in the Sun-centred overview", () => {
		const { simTimeJD, timeWarp, paused, focusId, hoverId, view, transition } =
			useSimStore.getInitialState()
		expect(Math.abs(simTimeJD - dateToJD(new Date()))).toBeLessThan(1 / 24)
		expect(timeWarp).toBe(1)
		expect(paused).toBe(false)
		expect(view).toEqual({ kind: "overview" })
		expect(focusId).toBe("sun")
		expect(hoverId).toBeNull()
		expect(transition).toBeNull()
		expect(useSimStore.getState().showOrbits).toBe(true)
		expect(useSimStore.getState().showLabels).toBe(true)
		expect(useSimStore.getState().showMoons).toBe(true)
		expect(useSimStore.getState().showMarkers).toBe(true)
	})

	// focus, selection and transitions: navigation.test.ts

	it("sets the warp and ignores non-finite values", () => {
		const { setTimeWarp } = useSimStore.getState()
		setTimeWarp(3600)
		expect(useSimStore.getState().timeWarp).toBe(3600)
		setTimeWarp(Number.NaN)
		setTimeWarp(Number.POSITIVE_INFINITY)
		expect(useSimStore.getState().timeWarp).toBe(3600)
		for (const { value } of WARP_PRESETS) {
			setTimeWarp(value)
			expect(useSimStore.getState().timeWarp).toBe(value)
		}
	})

	it("setSimTime ignores non-finite values", () => {
		const { setSimTime } = useSimStore.getState()
		setSimTime(J2000_JD)
		setSimTime(Number.NaN)
		expect(useSimStore.getState().simTimeJD).toBe(J2000_JD)
	})

	it("tracks hover and the scene toggles", () => {
		const state = useSimStore.getState()
		state.setHover("europa")
		expect(useSimStore.getState().hoverId).toBe("europa")
		state.setHover(null)
		expect(useSimStore.getState().hoverId).toBeNull()
		state.setShowOrbits(false)
		state.setShowLabels(false)
		state.setShowMoons(false)
		state.setShowMarkers(false)
		expect(useSimStore.getState().showOrbits).toBe(false)
		expect(useSimStore.getState().showLabels).toBe(false)
		expect(useSimStore.getState().showMoons).toBe(false)
		expect(useSimStore.getState().showMarkers).toBe(false)
	})

	it("keeps the focus visible while the moons are hidden", () => {
		const io = { id: "io", kind: "moon" } as const
		const europa = { id: "europa", kind: "moon" } as const
		const jupiter = { id: "jupiter", kind: "planet" } as const
		const shown = { showMoons: true, focusId: "sun" }
		const hidden = { showMoons: false, focusId: "io" }
		expect(isBodyShown(io, shown)).toBe(true)
		expect(isBodyShown(europa, shown)).toBe(true)
		expect(isBodyShown(io, hidden)).toBe(true)
		expect(isBodyShown(europa, hidden)).toBe(false)
		expect(isBodyShown(jupiter, hidden)).toBe(true)
		// through the store: focusing Io and hiding the moons leaves Io rendered
		useSimStore.getState().setFocus("io")
		useSimStore.getState().setShowMoons(false)
		expect(isBodyShown(io, useSimStore.getState())).toBe(true)
		expect(isBodyShown(europa, useSimStore.getState())).toBe(false)
	})

	it("offers the seven warp presets from the architecture", () => {
		expect(WARP_PRESETS.map((preset) => preset.value)).toEqual([
			1, 60, 3600, 86400, 604800, 2629800, 31557600,
		])
		expect(WARP_PRESETS.map((preset) => preset.label)).toEqual([
			"1x",
			"1 min/s",
			"1 h/s",
			"1 day/s",
			"1 week/s",
			"1 month/s",
			"1 year/s",
		])
	})
})
