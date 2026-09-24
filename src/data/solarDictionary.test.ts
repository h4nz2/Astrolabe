import { describe, expect, it } from "vitest"

import {
	SUN_ID,
	getSolarDictionaryItems,
	solarDictionary,
} from "./solarDictionary"

describe("solarDictionary", () => {
	it("lists the Sun first, then the eight planets with ids 0..8", () => {
		expect(solarDictionary).toHaveLength(9)
		expect(solarDictionary[0]).toMatchObject({ id: SUN_ID, name: "Sun" })
		expect(solarDictionary.map((item) => item.id)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8,
		])
	})

	it("gives every body a base texture under the public assets folder", () => {
		// resolved through assetUrl(), so the prefix is Vite's base (VITE_BASE), not "/"
		const prefix = `${import.meta.env.BASE_URL}assets/textures/`
		for (const item of solarDictionary) {
			expect(item.textures?.base.startsWith(prefix)).toBe(true)
			expect(item.textures?.base).toMatch(/\.(jpg|png)$/)
		}
	})

	it("looks items up by id and by name like the old resolver", () => {
		expect(getSolarDictionaryItems()).toBe(solarDictionary)
		expect(getSolarDictionaryItems({ ids: [3] }).map((i) => i.name)).toEqual([
			"Earth",
		])
		expect(
			getSolarDictionaryItems({ names: ["sun", "mar"] }).map((i) => i.name),
		).toEqual(["Sun", "Mars"])
	})
})
