import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { J2000_JD, SCALE_PRESETS, TRUE_SCALE } from "@/sim"

import { applyScale, scalePresetAttribute } from "./ScaleSync"
import { createSimFrame } from "./simFrame"

describe("applyScale", () => {
	it("pushes the store's scale into the frame and labels the canvas", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const canvas = { dataset: {} as DOMStringMap } as HTMLElement
		applyScale(frame, canvas, {
			scale: SCALE_PRESETS.everythingVisible,
			presetId: "everythingVisible",
		})
		expect(frame.scale).toBe(SCALE_PRESETS.everythingVisible)
		expect(frame.scaleVersion).toBe(1)
		expect(canvas.dataset.scalePreset).toBe("everythingVisible")

		applyScale(frame, canvas, { scale: TRUE_SCALE, presetId: "trueScale" })
		expect(frame.scale).toBe(TRUE_SCALE)
		expect(canvas.dataset.scalePreset).toBe("trueScale")
	})

	it("calls a mix that is no preset custom", () => {
		expect(scalePresetAttribute(null)).toBe("custom")
		expect(scalePresetAttribute("textbook")).toBe("textbook")
	})
})
