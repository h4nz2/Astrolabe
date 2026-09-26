import { describe, expect, it } from "vitest"

import {
	bodies,
	bodyById,
	childrenOf,
	getBody,
	moonsOf,
	planets,
	sun,
} from "./index"

describe("data index", () => {
	it("exposes the Sun and the eight planets", () => {
		expect(sun.id).toBe("sun")
		expect(sun.kind).toBe("star")
		expect(planets.map((planet) => planet.id)).toEqual([
			"mercury",
			"venus",
			"earth",
			"mars",
			"jupiter",
			"saturn",
			"uranus",
			"neptune",
		])
	})

	it("indexes every body by id", () => {
		expect(bodyById.size).toBe(bodies.length)
		for (const body of bodies) expect(bodyById.get(body.id)).toBe(body)
		expect(getBody("io").name).toBe("Io")
		expect(() => getBody("planet-x")).toThrow(/planet-x/)
	})

	it("lists children in orbital order and moons per planet", () => {
		// the planets, then the small bodies (#23), each group in orbital order
		expect(childrenOf("sun").slice(0, planets.length)).toEqual(planets)
		expect(
			childrenOf("sun")
				.slice(planets.length)
				.map((body) => body.kind),
		).not.toContain("planet")
		expect(moonsOf("earth").map((moon) => moon.id)).toEqual(["moon"])
		expect(moonsOf("mars").map((moon) => moon.id)).toEqual(["phobos", "deimos"])
		expect(moonsOf("mercury")).toEqual([])
		expect(moonsOf("moon")).toEqual([])
		expect(childrenOf("nowhere")).toEqual([])
		for (const planet of planets) {
			const moons = moonsOf(planet.id)
			expect(moons).toEqual(childrenOf(planet.id))
			for (let i = 1; i < moons.length; i++) {
				expect(moons[i].orbit!.semiMajorAxisKm).toBeGreaterThanOrEqual(
					moons[i - 1].orbit!.semiMajorAxisKm,
				)
			}
		}
	})

	it("hands out fresh arrays from childrenOf so callers cannot corrupt the index", () => {
		const first = childrenOf("sun")
		const length = first.length
		first.pop()
		expect(childrenOf("sun")).toHaveLength(length)
	})
})
