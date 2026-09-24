import { describe, expect, it } from "vitest"

import { TAP_MAX_TRAVEL_PX, isTap, isTapEvent, pointerKindOf } from "./tap"

describe("tap versus drag", () => {
	it("allows a finger more wobble than a mouse", () => {
		expect(isTap(4, "mouse")).toBe(true)
		expect(isTap(5, "mouse")).toBe(false)
		expect(isTap(10, "touch")).toBe(true)
		expect(isTap(TAP_MAX_TRAVEL_PX.touch + 1, "touch")).toBe(false)
		expect(TAP_MAX_TRAVEL_PX.pen).toBeGreaterThan(TAP_MAX_TRAVEL_PX.mouse)
	})

	it("reads the pointer type of the click, falling back to the mouse", () => {
		expect(pointerKindOf({ pointerType: "touch" } as unknown as Event)).toBe(
			"touch",
		)
		expect(pointerKindOf({} as Event)).toBe("mouse")
	})

	it("judges R3F click events by their travel", () => {
		const click = (delta: number, pointerType: string) => ({
			delta,
			nativeEvent: { pointerType } as unknown as Event,
		})
		expect(isTapEvent(click(0, "mouse"))).toBe(true)
		expect(isTapEvent(click(8, "mouse"))).toBe(false)
		expect(isTapEvent(click(8, "touch"))).toBe(true)
	})
})
