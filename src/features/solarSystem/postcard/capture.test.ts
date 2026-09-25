import { describe, expect, it } from "vitest"

import { CAPTURE_LONG_SIDE, captureRatio } from "./capture"

describe("the picture's resolution", () => {
	it("raises a small screen's picture to a clean size", () => {
		// a 1280 x 720 projector at 1x: 1920 x 1080
		expect(captureRatio(1280, 720, 1)).toBeCloseTo(1.5)
		expect(1280 * captureRatio(1280, 720, 1)).toBeCloseTo(CAPTURE_LONG_SIDE)
		// a phone in portrait: the long side counts
		expect(844 * captureRatio(390, 844, 2)).toBeGreaterThanOrEqual(
			CAPTURE_LONG_SIDE,
		)
	})

	it("never lowers the screen's own sharpness", () => {
		expect(captureRatio(1920, 1080, 1)).toBe(1)
		expect(captureRatio(1440, 900, 2)).toBe(2)
	})

	it("stays within the size limit", () => {
		expect(2560 * captureRatio(2560, 1440, 2, 4096)).toBeLessThanOrEqual(4096)
		expect(captureRatio(800, 600, 1, 1000)).toBeCloseTo(1.25)
	})
})
