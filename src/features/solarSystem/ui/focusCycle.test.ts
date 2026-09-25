import { describe, expect, it } from "vitest"

import { childrenOf } from "@/data"

import { cycleFocus, focusRing } from "./focusCycle"

describe("focusRing", () => {
	it("is the Sun and the planets for the Sun and for a planet", () => {
		const top = [
			"sun",
			"mercury",
			"venus",
			"earth",
			"mars",
			"jupiter",
			"saturn",
			"uranus",
			"neptune",
		]
		expect(focusRing("sun")).toEqual(top)
		expect(focusRing("mars")).toEqual(top)
	})

	it("is the featured moons of the same planet for a moon (#17)", () => {
		expect(focusRing("io")).toEqual(["io", "europa", "ganymede", "callisto"])
		// a long-tail moon in focus stays in its own ring
		expect(focusRing("metis")).toEqual([
			"metis",
			"io",
			"europa",
			"ganymede",
			"callisto",
		])
	})

	it("is every moon of the same planet while all moons are shown", () => {
		expect(focusRing("io", true)).toEqual(
			childrenOf("jupiter").map((m) => m.id),
		)
	})

	it("is empty for an unknown id", () => {
		expect(focusRing("planet-x")).toEqual([])
	})
})

describe("cycleFocus", () => {
	it("wraps around the ring in both directions", () => {
		expect(cycleFocus("sun", 1)).toBe("mercury")
		expect(cycleFocus("sun", -1)).toBe("neptune")
		expect(cycleFocus("neptune", 1)).toBe("sun")
		expect(cycleFocus("mercury", -1)).toBe("sun")
	})

	it("steps between neighbouring moons in orbital order", () => {
		expect(cycleFocus("io", 1)).toBe("europa")
		expect(cycleFocus("io", -1)).toBe("callisto")
		const jovian = childrenOf("jupiter").map((m) => m.id)
		const io = jovian.indexOf("io")
		expect(cycleFocus("io", 1, true)).toBe(jovian[io + 1])
		expect(cycleFocus("io", -1, true)).toBe(jovian[io - 1])
	})

	it("stays put for an only child and for an unknown id", () => {
		expect(cycleFocus("moon", 1)).toBe("moon")
		expect(cycleFocus("planet-x", 1)).toBe("planet-x")
	})
})
