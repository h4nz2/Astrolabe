/**
 * The spacecraft content contract (issue #35): every shipped locale names and
 * describes every craft of src/data/spacecraft.json at every reading level
 * (the milestone wording is tested in features/solarSystem/spacecraft/text.test.ts).
 */
import { describe, expect, it } from "vitest"

import { spacecraft } from "@/data/spacecraft"
import { SPACECRAFT_EXTRA_TARGETS } from "@/data/spacecraftSchema"

import { LOCALES, READING_LEVELS } from "./catalog"
import { createI18n } from "./core"
import { levelsOf } from "./bodies"
import {
	SpacecraftContentFile,
	getSpacecraftText,
	spacecraftContent,
	spacecraftName,
} from "./spacecraft"

const ids = spacecraft.map((craft) => craft.id)

describe.each(LOCALES)("spacecraft content, locale %s", (locale) => {
	const file = spacecraftContent.get(locale)

	it("exists and matches the schema", () => {
		expect(file).toBeDefined()
		expect(() => SpacecraftContentFile.parse(file)).not.toThrow()
	})

	it("covers exactly the catalogue's craft", () => {
		expect(Object.keys(file ?? {}).sort()).toEqual([...ids].sort())
	})

	it("describes every craft at every reading level", () => {
		for (const id of ids) {
			const description = file?.[id]?.description
			expect(levelsOf(description).sort(), id).toEqual(
				[...READING_LEVELS].sort(),
			)
		}
	})

	it("gives every craft a name, a tagline and a description at every level", () => {
		for (const readingLevel of READING_LEVELS) {
			const i18n = createI18n({ locale, readingLevel })
			for (const id of ids) {
				const text = getSpacecraftText(id, i18n)
				expect(text.name, id).not.toBe(id)
				expect(text.tagline.length, id).toBeGreaterThan(3)
				expect(text.description.length, id).toBeGreaterThan(40)
			}
		}
	})

	it("names the targets that are not bodies", () => {
		const i18n = createI18n({ locale })
		for (const target of SPACECRAFT_EXTRA_TARGETS) {
			expect(
				i18n.t(`solarSystem.spacecraft.target.${target}` as never),
			).not.toMatch(/spacecraft\./)
		}
	})
})

describe("spacecraftName", () => {
	it("translates where a language has its own name", () => {
		expect(spacecraftName("jwst", ["de", "en"])).toBe(
			"James-Webb-Weltraumteleskop",
		)
		expect(spacecraftName("jwst", ["en"])).toBe("James Webb Space Telescope")
		expect(spacecraftName("voyager1", ["de", "en"])).toBe("Voyager 1")
	})
	it("falls back to the id for unknown craft", () => {
		expect(spacecraftName("nope", ["en"])).toBe("nope")
	})
})
