import { describe, expect, it } from "vitest"

import { createI18n } from "./core"
import {
	flattenMessages,
	formatMessage,
	lookupMessage,
	splitLevel,
	type FlatMessages,
} from "./messages"

describe("flattenMessages", () => {
	it("turns the tree into dotted keys and keeps level suffixes", () => {
		const flat = flattenMessages({
			a: { b: "B", "c@simple": "C simple", c: "C" },
			d: "D",
		})
		expect([...flat]).toEqual([
			["a.b", "B"],
			["a.c@simple", "C simple"],
			["a.c", "C"],
			["d", "D"],
		])
	})

	it("splits a key from its reading level", () => {
		expect(splitLevel("a.c@simple")).toEqual(["a.c", "simple"])
		expect(splitLevel("a.c")).toEqual(["a.c", undefined])
	})
})

describe("lookupMessage", () => {
	const catalog: ReadonlyMap<string, FlatMessages> = new Map([
		[
			"en",
			new Map([
				["period", "Orbital period"],
				["period@simple", "Time for one lap"],
				["onlyEnglish", "English only"],
			]),
		],
		["de", new Map([["period", "Umlaufzeit"]])],
	])

	it("prefers the level variant, then the plain text, per locale", () => {
		expect(
			lookupMessage(catalog, ["en"], "period", "simple", "standard"),
		).toEqual({ text: "Time for one lap", locale: "en" })
		expect(
			lookupMessage(catalog, ["en"], "period", "advanced", "standard"),
		).toEqual({ text: "Orbital period", locale: "en" })
	})

	it("keeps the language before the reading level", () => {
		// a German reader on "simple" gets German standard text, not English simple text
		expect(
			lookupMessage(catalog, ["de", "en"], "period", "simple", "standard"),
		).toEqual({ text: "Umlaufzeit", locale: "de" })
	})

	it("falls back along the chain and reports where it found the text", () => {
		expect(
			lookupMessage(catalog, ["de", "en"], "onlyEnglish", "simple", "standard"),
		).toEqual({ text: "English only", locale: "en" })
		expect(
			lookupMessage(catalog, ["de", "en"], "missing", "simple", "standard"),
		).toBeUndefined()
	})
})

describe("formatMessage", () => {
	it("applies the plural rules and number format of the locale", () => {
		const days = "{n, plural, one {# day} other {# days}}"
		expect(formatMessage(days, "en", { n: 1 })).toBe("1 day")
		expect(formatMessage(days, "en", { n: 1.5 })).toBe("1.5 days")
		expect(formatMessage(days, "de", { n: 1234.5 })).toBe("1.234,5 days")
	})

	it("returns undefined for broken text or a missing value instead of throwing", () => {
		expect(formatMessage("{n, plural, one {x}", "en", { n: 1 })).toBeUndefined()
		expect(formatMessage("Hello {name}", "en", {})).toBeUndefined()
	})

	it("leaves angle brackets alone", () => {
		expect(formatMessage("a <b> c", "en")).toBe("a <b> c")
	})
})

describe("createI18n", () => {
	it("translates with the active locale, level and formatting locale", () => {
		const de = createI18n({ locale: "de", formatLocale: "de-CH" })
		expect(de.t("solarSystem.time.now")).toBe("Jetzt")
		expect(de.t("solarSystem.time.warp.day", { count: 2 })).toBe("2 Tage/s")
		expect(de.chain).toEqual(["de", "en"])
		expect(de.number(1234567)).toBe(
			new Intl.NumberFormat("de-CH").format(1234567),
		)
	})

	it("uses reading-level variants where a message has them", () => {
		expect(
			createI18n({ locale: "en", readingLevel: "simple" }).t(
				"solarSystem.info.orbitalPeriod",
			),
		).toBe("Time for one lap")
		expect(
			createI18n({ locale: "en", readingLevel: "advanced" }).t(
				"solarSystem.info.orbitalPeriod",
			),
		).toBe("Orbital period")
	})

	it("selects grammatical forms by argument", () => {
		const de = createI18n({ locale: "de" })
		expect(
			de.t("solarSystem.info.distance", { parentId: "sun", parent: "Sonne" }),
		).toBe("Abstand zur Sonne")
		expect(
			de.t("solarSystem.info.distance", {
				parentId: "jupiter",
				parent: "Jupiter",
			}),
		).toBe("Abstand zum Jupiter")
		expect(
			de.t("bodies.kind.moonOf", { parentId: "earth", parent: "Erde" }),
		).toBe("Mond der Erde")
	})

	it("never shows a raw error: missing values fall back to the key", () => {
		const en = createI18n({ locale: "en" })
		expect(en.t("solarSystem.time.warp.day")).toBe("solarSystem.time.warp.day")
	})
})
