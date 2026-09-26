import { describe, expect, it } from "vitest"

import {
	HINT_GAP,
	HINT_MARGIN,
	overlaps,
	placeHint,
	unionBox,
	type Box,
} from "./placement"

const viewport = { width: 1280, height: 720 }
const hint = { width: 240, height: 60 }

const boxOf = (placement: { top: number; left: number }): Box => ({
	...placement,
	...hint,
})

describe("placeHint", () => {
	it("puts the hint above the control, centred, when there is room", () => {
		const anchor = { top: 400, left: 500, width: 100, height: 24 }
		const placed = placeHint(anchor, hint, viewport)
		expect(placed.side).toBe("above")
		expect(placed.top).toBe(400 - HINT_GAP - hint.height)
		expect(placed.left).toBe(550 - hint.width / 2)
		expect(overlaps(boxOf(placed), anchor)).toBe(false)
	})

	it("goes below a control at the top of the screen", () => {
		const anchor = { top: 10, left: 500, width: 100, height: 24 }
		const placed = placeHint(anchor, hint, viewport)
		expect(placed.side).toBe("below")
		expect(placed.top).toBe(34 + HINT_GAP)
		expect(overlaps(boxOf(placed), anchor)).toBe(false)
	})

	it("stays inside the viewport next to its edges", () => {
		const right = placeHint(
			{ top: 400, left: 1250, width: 30, height: 20 },
			hint,
			viewport,
		)
		expect(right.left).toBe(viewport.width - HINT_MARGIN - hint.width)
		const left = placeHint(
			{ top: 400, left: 0, width: 30, height: 20 },
			hint,
			viewport,
		)
		expect(left.left).toBe(HINT_MARGIN)
	})

	it("never covers the control anywhere on a phone screen", () => {
		const phone = { width: 360, height: 640 }
		for (let top = 0; top <= 616; top += 8) {
			for (let left = 0; left <= 300; left += 20) {
				const anchor = { top, left, width: 60, height: 24 }
				const placed = placeHint(anchor, hint, phone)
				expect(overlaps(boxOf(placed), anchor)).toBe(false)
			}
		}
	})

	it("picks the roomier side when it fits on neither", () => {
		const tall = { width: 240, height: 400 }
		const placed = placeHint(
			{ top: 200, left: 100, width: 60, height: 24 },
			tall,
			{ width: 360, height: 640 },
		)
		expect(placed.side).toBe("below")
	})
})

describe("unionBox", () => {
	it("spans every box with an area and ignores empty ones", () => {
		expect(
			unionBox([
				{ top: 10, left: 10, width: 20, height: 10 },
				{ top: 0, left: 0, width: 0, height: 0 },
				{ top: 15, left: 40, width: 10, height: 20 },
			]),
		).toEqual({ top: 10, left: 10, width: 40, height: 25 })
		expect(unionBox([])).toBeNull()
	})
})
