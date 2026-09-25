import { describe, expect, it } from "vitest"

import { bodies } from "@/data"

import {
	COMPARE_PRESETS,
	DEFAULT_COMPARE,
	MAX_COMPARE,
	addBody,
	completeBodies,
	defaultPartner,
	drawOrder,
	parseBodies,
	promote,
	removeBody,
	replaceAt,
	swapPair,
} from "./selection"

describe("parseBodies", () => {
	it("keeps known ids once, in order, up to the limit", () => {
		expect(parseBodies("earth,jupiter")).toEqual(["earth", "jupiter"])
		expect(parseBodies(" earth , vulcan,earth,moon")).toEqual(["earth", "moon"])
		expect(parseBodies(undefined)).toEqual([])
		expect(parseBodies(bodies.map((body) => body.id).join(","))).toHaveLength(
			MAX_COMPARE,
		)
	})
})

describe("completeBodies", () => {
	it("always makes a pair", () => {
		expect(completeBodies([])).toEqual([...DEFAULT_COMPARE])
		expect(completeBodies(["jupiter"])).toEqual(["jupiter", "earth"])
		expect(completeBodies(["earth"])).toEqual(["earth", "sun"])
		expect(completeBodies(["io"])).toEqual(["io", "moon"])
		expect(completeBodies(["moon"])).toEqual(["moon", "earth"])
		expect(completeBodies(["sun"])).toEqual(["sun", "earth"])
	})

	it("has a partner for every body that is not the body itself", () => {
		for (const body of bodies) {
			expect(defaultPartner(body.id)).not.toBe(body.id)
		}
	})
})

describe("editing the list", () => {
	it("replaces, swapping instead of repeating a body", () => {
		expect(replaceAt(["earth", "jupiter"], 1, "mars")).toEqual([
			"earth",
			"mars",
		])
		expect(replaceAt(["earth", "jupiter"], 0, "jupiter")).toEqual([
			"jupiter",
			"earth",
		])
		expect(replaceAt(["earth", "jupiter"], 1, "vulcan")).toEqual([
			"earth",
			"jupiter",
		])
	})

	it("promotes a drawn body into the pair", () => {
		expect(promote(["earth", "jupiter", "saturn", "mars"], "mars")).toEqual([
			"earth",
			"mars",
			"jupiter",
			"saturn",
		])
		expect(promote(["earth", "jupiter"], "earth")).toEqual(["earth", "jupiter"])
	})

	it("swaps, adds and removes, keeping a pair", () => {
		expect(swapPair(["earth", "jupiter", "mars"])).toEqual([
			"jupiter",
			"earth",
			"mars",
		])
		expect(addBody(["earth", "jupiter"], "mars")).toEqual([
			"earth",
			"jupiter",
			"mars",
		])
		expect(addBody(["earth", "jupiter"], "earth")).toEqual(["earth", "jupiter"])
		expect(removeBody(["earth", "jupiter", "mars"], "jupiter")).toEqual([
			"earth",
			"mars",
		])
		expect(removeBody(["earth", "jupiter"], "jupiter")).toEqual([
			"earth",
			"jupiter",
		])
	})

	it("draws in the order of the solar system", () => {
		expect(drawOrder(["moon", "jupiter", "sun", "earth"])).toEqual([
			"sun",
			"earth",
			"moon",
			"jupiter",
		])
	})
})

describe("presets", () => {
	it("name only known bodies, without repeats", () => {
		for (const preset of COMPARE_PRESETS) {
			expect(parseBodies(preset.bodies.join(","))).toEqual(preset.bodies)
			expect(preset.bodies.length).toBeGreaterThanOrEqual(2)
		}
	})
})
