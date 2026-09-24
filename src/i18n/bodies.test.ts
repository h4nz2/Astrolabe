import { describe, expect, it } from "vitest"

import { bodyById, planets, sun } from "@/data"

import {
	BodyContentFile,
	bodyContent,
	bodyKindLabel,
	bodyName,
	getBodyText,
	levelsOf,
	pickLevel,
} from "./bodies"
import { DEFAULT_LOCALE, LOCALES, READING_LEVELS } from "./catalog"
import { createI18n } from "./core"

/** Bodies that must have every field at every reading level in every locale. */
const AUTHORED = [sun.id, ...planets.map((planet) => planet.id)]

/** Moons whose names every locale must state (translated or confirmed identical). */
const MAJOR_MOONS = [
	"moon",
	"phobos",
	"deimos",
	"io",
	"europa",
	"ganymede",
	"callisto",
	"mimas",
	"enceladus",
	"tethys",
	"dione",
	"rhea",
	"titan",
	"hyperion",
	"iapetus",
	"miranda",
	"ariel",
	"umbriel",
	"titania",
	"oberon",
	"triton",
	"nereid",
	"proteus",
]

const reference = bodyContent.get(DEFAULT_LOCALE)!

it("every locale folder with a ui.json has a bodies.json", () => {
	expect([...bodyContent.keys()].sort()).toEqual([...LOCALES].sort())
})

describe.each(LOCALES)("bodies.json of %s", (locale) => {
	const content = bodyContent.get(locale)!

	it("matches the schema", () => {
		const result = BodyContentFile.safeParse(content)
		expect(result.success ? [] : result.error.issues).toEqual([])
	})

	it("is keyed by known body ids", () => {
		expect(Object.keys(content).filter((id) => !bodyById.has(id))).toEqual([])
	})

	it("covers the same bodies, fields and reading levels as the reference", () => {
		const shape = (file: typeof content) =>
			Object.fromEntries(
				Object.entries(file).map(([id, entry]) => [
					id,
					Object.fromEntries(
						Object.entries(entry).map(([field, value]) => [
							field,
							levelsOf(value),
						]),
					),
				]),
			)
		expect(shape(content)).toEqual(shape(reference))
	})

	it.each(AUTHORED)("has full content for %s at every reading level", (id) => {
		const entry = content[id]
		expect(entry?.name).toBeTruthy()
		expect(entry?.tagline).toBeTruthy()
		for (const field of ["description", "facts", "comparisons"] as const) {
			expect(levelsOf(entry?.[field]).sort(), `${id}.${field}`).toEqual(
				[...READING_LEVELS].sort(),
			)
		}
	})

	it("names the major moons", () => {
		expect(MAJOR_MOONS.filter((id) => !content[id]?.name)).toEqual([])
	})
})

it("uses the catalogue names in English", () => {
	const mismatched = Object.entries(reference)
		.filter(([id, entry]) => entry.name !== bodyById.get(id)?.name)
		.map(([id]) => id)
	expect(mismatched).toEqual([])
})

describe("bodyName", () => {
	it("translates planets and major moons", () => {
		expect(bodyName("earth", ["de", "en"])).toBe("Erde")
		expect(bodyName("sun", ["de", "en"])).toBe("Sonne")
		expect(bodyName("ganymede", ["de", "en"])).toBe("Ganymed")
		expect(bodyName("earth", ["en"])).toBe("Earth")
	})

	it("never translates provisional designations", () => {
		const provisional = bodyById.get("s2003j2")
		expect(provisional?.name).toBe("S/2003 J 2")
		expect(bodyName("s2003j2", ["de", "en"])).toBe("S/2003 J 2")
	})

	it("falls back to the id for unknown bodies", () => {
		expect(bodyName("nowhere", ["de", "en"])).toBe("nowhere")
	})
})

describe("pickLevel", () => {
	it("returns plain values as they are and falls back to the default level", () => {
		expect(pickLevel("same", "simple")).toBe("same")
		expect(pickLevel(["a"], "simple")).toEqual(["a"])
		expect(pickLevel({ standard: "std", simple: "easy" }, "simple")).toBe(
			"easy",
		)
		expect(pickLevel({ standard: "std" }, "advanced")).toBe("std")
		expect(pickLevel(undefined, "simple")).toBeUndefined()
	})
})

describe("getBodyText", () => {
	it("gives authored content at the active language and level", () => {
		const simple = getBodyText(
			"mars",
			createI18n({ locale: "de", readingLevel: "simple" }),
		)
		expect(simple.name).toBe("Mars")
		expect(simple.tagline).toBe("Der rote Planet")
		expect(simple.description).toMatch(/^Mars heißt der rote Planet/)
		expect(simple.facts.length).toBeGreaterThan(0)
		expect(simple.authored).toBe(true)

		const advanced = getBodyText(
			"mars",
			createI18n({ locale: "de", readingLevel: "advanced" }),
		)
		expect(advanced.description).not.toBe(simple.description)
	})

	it("generates a description from the data for moons without one", () => {
		const io = getBodyText("io", createI18n({ locale: "en" }))
		expect(io.authored).toBe(false)
		expect(io.tagline).toBe("Moon of Jupiter")
		expect(io.description).toMatch(
			/^Io is a moon of Jupiter\. It is about 3,6\d\d km across/,
		)
		expect(io.description).toMatch(/every 1\.77 days\.$/)

		const deIo = getBodyText("io", createI18n({ locale: "de" }))
		expect(deIo.description).toMatch(/^Io ist ein Mond des Jupiter\./)
		expect(deIo.facts).toEqual([])
	})

	it("uses hours for moons that circle their planet in under a day", () => {
		const phobos = getBodyText("phobos", createI18n({ locale: "en" }))
		expect(phobos.description).toMatch(/every 7\.\d+ hours\.$/)
	})
})

describe("bodyKindLabel", () => {
	it("names the kind, with the planet for moons", () => {
		const de = createI18n({ locale: "de" })
		expect(bodyKindLabel(bodyById.get("earth")!, de)).toBe("Planet")
		expect(bodyKindLabel(bodyById.get("sun")!, de)).toBe("Stern")
		expect(bodyKindLabel(bodyById.get("moon")!, de)).toBe("Mond der Erde")
		expect(bodyKindLabel(bodyById.get("titan")!, de)).toBe("Mond des Saturn")
	})
})
