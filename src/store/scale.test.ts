import { afterEach, describe, expect, it } from "vitest"

import { SCALE_PRESETS, TRUE_SCALE, interpolateScale } from "@/sim"

import { DEFAULT_SCALE, useScaleStore } from "./scale"

const reset = () =>
	useScaleStore.setState(useScaleStore.getInitialState(), true)

afterEach(reset)

describe("useScaleStore", () => {
	it("opens in Everything visible", () => {
		const { scale, presetId } = useScaleStore.getState()
		expect(presetId).toBe("everythingVisible")
		expect(scale).toBe(SCALE_PRESETS.everythingVisible)
		expect(DEFAULT_SCALE).toBe(SCALE_PRESETS.everythingVisible)
	})

	it("switches presets and ignores unknown ids", () => {
		const { setPreset } = useScaleStore.getState()
		setPreset("trueScale")
		expect(useScaleStore.getState().scale).toBe(TRUE_SCALE)
		expect(useScaleStore.getState().presetId).toBe("trueScale")
		setPreset("nonsense" as never)
		expect(useScaleStore.getState().presetId).toBe("trueScale")
	})

	it("takes any valid mix, recognising presets by value and keeping their frozen object", () => {
		const { setScale } = useScaleStore.getState()
		const halfway = interpolateScale(TRUE_SCALE, SCALE_PRESETS.textbook, 0.5)
		setScale(halfway)
		expect(useScaleStore.getState().scale).toBe(halfway)
		expect(useScaleStore.getState().presetId).toBeNull()
		setScale({ ...SCALE_PRESETS.textbook })
		expect(useScaleStore.getState().scale).toBe(SCALE_PRESETS.textbook)
		expect(useScaleStore.getState().presetId).toBe("textbook")
	})

	it("adjusts each factor independently and ignores invalid values", () => {
		const { setFactor } = useScaleStore.getState()
		setFactor("bodySize", { exponent: 1 })
		const after = useScaleStore.getState().scale
		expect(after.bodySize.exponent).toBe(1)
		expect(after.orbitDistance).toBe(
			SCALE_PRESETS.everythingVisible.orbitDistance,
		)
		expect(after.moonDistance).toBe(
			SCALE_PRESETS.everythingVisible.moonDistance,
		)
		expect(useScaleStore.getState().presetId).toBeNull()

		setFactor("moonDistance", { knee: 0, exponent: 1, gain: 1 })
		expect(useScaleStore.getState().scale).toBe(after)
		setFactor("orbitDistance", TRUE_SCALE.orbitDistance)
		setFactor("moonDistance", TRUE_SCALE.moonDistance)
		expect(useScaleStore.getState().presetId).toBe("trueScale")
	})
})
