import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
	CLOSE_DELAY_MS,
	FOCUS_DELAY_MS,
	HOVER_DELAY_MS,
	HintController,
	LONG_PRESS_MS,
	resetHintsForTests,
	type HintState,
} from "./controller"

function make() {
	const seen: (HintState<string> | null)[] = []
	const controller = new HintController<string>(
		(state) => seen.push(state),
		() => Date.now(),
	)
	return { controller, seen, open: () => controller.current?.key ?? null }
}

beforeEach(() => {
	vi.useFakeTimers()
	resetHintsForTests()
})
afterEach(() => {
	vi.useRealTimers()
})

describe("hover", () => {
	it("opens after the delay, not while the pointer only passes by", () => {
		const { controller, open } = make()
		controller.hoverStart("orbits", "a")
		vi.advanceTimersByTime(HOVER_DELAY_MS - 1)
		expect(open()).toBeNull()
		controller.hoverEnd()
		vi.advanceTimersByTime(HOVER_DELAY_MS)
		expect(open()).toBeNull()

		controller.hoverStart("orbits", "a")
		vi.advanceTimersByTime(HOVER_DELAY_MS)
		expect(open()).toBe("orbits")
		expect(controller.current?.via).toBe("hover")
	})

	it("closes after a short grace, which coming back cancels", () => {
		const { controller, open } = make()
		controller.hoverStart("", "a")
		vi.advanceTimersByTime(HOVER_DELAY_MS)
		controller.hoverEnd()
		controller.hoverStart("", "a")
		vi.advanceTimersByTime(CLOSE_DELAY_MS * 2)
		expect(open()).toBe("")
		controller.hoverEnd()
		vi.advanceTimersByTime(CLOSE_DELAY_MS)
		expect(open()).toBeNull()
	})

	it("switches at once between options of an open zone", () => {
		const { controller, open } = make()
		controller.hoverStart("trueScale", "a")
		vi.advanceTimersByTime(HOVER_DELAY_MS)
		controller.hoverStart("textbook", "b")
		expect(open()).toBe("textbook")
		expect(controller.current?.anchor).toBe("b")
	})

	it("keeps one hint open in the page, and the next one opens at once", () => {
		const first = make()
		const second = make()
		first.controller.hoverStart("", "a")
		vi.advanceTimersByTime(HOVER_DELAY_MS)
		second.controller.hoverStart("", "b")
		expect(second.open()).toBe("")
		expect(first.open()).toBeNull()
	})

	it("hides on a mouse press until the pointer leaves", () => {
		const { controller, open } = make()
		controller.hoverStart("", "a")
		vi.advanceTimersByTime(HOVER_DELAY_MS)
		controller.pressStart("mouse", 0, 0, "", "a")
		expect(open()).toBeNull()
		controller.hoverStart("", "a")
		vi.advanceTimersByTime(HOVER_DELAY_MS * 2)
		expect(open()).toBeNull()
		controller.hoverEnd()
		vi.advanceTimersByTime(1000)
		controller.hoverStart("", "a")
		vi.advanceTimersByTime(HOVER_DELAY_MS)
		expect(open()).toBe("")
	})
})

describe("keyboard focus", () => {
	it("opens for keyboard focus and closes on blur", () => {
		const { controller, open } = make()
		controller.focusIn("", "a", true)
		vi.advanceTimersByTime(FOCUS_DELAY_MS)
		expect(open()).toBe("")
		expect(controller.current?.via).toBe("focus")
		controller.focusOut()
		expect(open()).toBeNull()
	})

	it("ignores focus that a mouse click or a tap gave", () => {
		const { controller, open } = make()
		controller.focusIn("", "a", false)
		vi.advanceTimersByTime(FOCUS_DELAY_MS * 4)
		expect(open()).toBeNull()
	})

	it("ignores focus that follows a press (a tapped text field is :focus-visible too)", () => {
		const { controller, open } = make()
		controller.pressStart("touch", 0, 0, "", "a")
		controller.pressEnd()
		controller.focusIn("", "a", true)
		vi.advanceTimersByTime(FOCUS_DELAY_MS * 4)
		expect(open()).toBeNull()
	})

	it("is dismissed by Escape", () => {
		const { controller, open } = make()
		controller.focusIn("", "a", true)
		vi.advanceTimersByTime(FOCUS_DELAY_MS)
		controller.dismiss()
		expect(open()).toBeNull()
	})
})

describe("touch", () => {
	it("a plain tap toggles: no hint, and its click goes through", () => {
		const { controller, open } = make()
		controller.pressStart("touch", 10, 10, "", "a")
		vi.advanceTimersByTime(100)
		controller.pressEnd()
		vi.advanceTimersByTime(LONG_PRESS_MS)
		expect(open()).toBeNull()
		expect(controller.takeClick()).toBe(false)
	})

	it("a long press shows the hint and swallows the click that follows", () => {
		const { controller, open } = make()
		controller.pressStart("touch", 10, 10, "moons", "a")
		vi.advanceTimersByTime(LONG_PRESS_MS)
		expect(open()).toBe("moons")
		expect(controller.current?.via).toBe("touch")
		controller.pressEnd()
		expect(controller.takeClick()).toBe(true)
		// only once: the next tap toggles again
		expect(controller.takeClick()).toBe(false)
		// the hint stays up to be read, until the next touch anywhere
		vi.advanceTimersByTime(10_000)
		expect(open()).toBe("moons")
		controller.dismiss()
		expect(open()).toBeNull()
	})

	it("a finger that moves is scrolling, not pressing", () => {
		const { controller, open } = make()
		controller.pressStart("touch", 10, 10, "", "a")
		controller.pressMove(10, 40)
		vi.advanceTimersByTime(LONG_PRESS_MS * 2)
		expect(open()).toBeNull()
	})
})
