import { afterEach, describe, expect, it } from "vitest"

import { SCALE_PRESETS } from "@/sim"
import { SCALE_TRANSITION_MS, useScaleStore } from "@/store/scale"

import { stepScaleTransition } from "./ScaleTransition"

afterEach(() => useScaleStore.setState(useScaleStore.getInitialState(), true))

describe("stepScaleTransition", () => {
	it("does nothing without a transition and steps a running one", () => {
		const before = useScaleStore.getState()
		stepScaleTransition(123)
		expect(useScaleStore.getState()).toBe(before)

		useScaleStore.getState().switchTo("textbook", 0)
		stepScaleTransition(SCALE_TRANSITION_MS / 2)
		expect(useScaleStore.getState().presetId).toBeNull()
		stepScaleTransition(SCALE_TRANSITION_MS)
		expect(useScaleStore.getState().scale).toBe(SCALE_PRESETS.textbook)
	})
})
