import { describe, expect, it } from "vitest"

import { WARP_PRESETS } from "@/store/sim"

import { stepWarp, warpLabel } from "./warp"

const values = WARP_PRESETS.map((preset) => preset.value)

describe("stepWarp", () => {
	it("walks the presets and stops at the ends", () => {
		expect(stepWarp(1, 1)).toBe(60)
		expect(stepWarp(60, -1)).toBe(1)
		expect(stepWarp(values[values.length - 1], 1)).toBe(
			values[values.length - 1],
		)
		expect(stepWarp(1, -1)).toBe(1)
	})

	it("snaps a non-preset warp to the next preset in the pressed direction", () => {
		expect(stepWarp(100, 1)).toBe(3600)
		expect(stepWarp(100, -1)).toBe(60)
		expect(stepWarp(0.5, -1)).toBe(0.5)
	})
})

describe("warpLabel", () => {
	it("uses the preset label when there is one", () => {
		expect(warpLabel(86400)).toBe("1 day/s")
		expect(warpLabel(120)).toBe("120x")
	})
})
