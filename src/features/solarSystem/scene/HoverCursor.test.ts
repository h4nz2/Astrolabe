import { describe, expect, it } from "vitest"

import { OVERVIEW } from "@/store/navigation"

import { applyHoverCursor, isClickTarget } from "./HoverCursor"

const earthView = { kind: "body", id: "earth" } as const

describe("isClickTarget", () => {
	it("is nothing without a hovered body", () => {
		expect(
			isClickTarget({ hoverId: null, view: OVERVIEW, selectedId: null }),
		).toBe(false)
	})

	it("is any hovered body a click would focus or select", () => {
		expect(
			isClickTarget({ hoverId: "sun", view: OVERVIEW, selectedId: null }),
		).toBe(true)
		expect(
			isClickTarget({ hoverId: "moon", view: earthView, selectedId: "earth" }),
		).toBe(true)
		// the focus while something else is selected: a click selects it
		expect(
			isClickTarget({ hoverId: "earth", view: earthView, selectedId: "moon" }),
		).toBe(true)
		// the anchor of a panned view: a click flies back to it
		expect(
			isClickTarget({
				hoverId: "earth",
				view: { kind: "point", anchorId: "earth", offsetKm: [1e4, 0, 0] },
				selectedId: "earth",
			}),
		).toBe(true)
	})

	it("is not the focus once it is also selected", () => {
		expect(
			isClickTarget({ hoverId: "earth", view: earthView, selectedId: "earth" }),
		).toBe(false)
	})
})

describe("applyHoverCursor", () => {
	it("shows the pointer over a click target and restores the default", () => {
		const canvas = { style: { cursor: "" } } as HTMLElement
		applyHoverCursor(canvas, {
			hoverId: "mars",
			view: earthView,
			selectedId: "earth",
		})
		expect(canvas.style.cursor).toBe("pointer")
		applyHoverCursor(canvas, {
			hoverId: "earth",
			view: earthView,
			selectedId: "earth",
		})
		expect(canvas.style.cursor).toBe("")
		applyHoverCursor(canvas, {
			hoverId: "mars",
			view: earthView,
			selectedId: "earth",
		})
		applyHoverCursor(canvas, null)
		expect(canvas.style.cursor).toBe("")
	})
})
