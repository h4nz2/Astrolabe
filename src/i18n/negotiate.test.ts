import { describe, expect, it } from "vitest"

import {
	formattingLocale,
	localeChain,
	matchLocale,
	resolveLocale,
	resolveReadingLevel,
} from "./negotiate"

const available = ["en", "de"]

describe("matchLocale", () => {
	it("matches exactly, case-insensitively, then by stripping subtags", () => {
		expect(matchLocale("de", available)).toBe("de")
		expect(matchLocale("DE", available)).toBe("de")
		expect(matchLocale("de-CH", available)).toBe("de")
		expect(matchLocale("de_AT", available)).toBe("de")
		expect(matchLocale("en-US-x-private", available)).toBe("en")
	})

	it("prefers a regional locale when one is shipped", () => {
		expect(matchLocale("de-CH", ["en", "de", "de-CH"])).toBe("de-CH")
		expect(matchLocale("de-DE", ["en", "de", "de-CH"])).toBe("de")
	})

	it("returns undefined for unknown or empty tags", () => {
		expect(matchLocale("fr", available)).toBeUndefined()
		expect(matchLocale("", available)).toBeUndefined()
		expect(matchLocale(undefined, available)).toBeUndefined()
		expect(matchLocale(null, available)).toBeUndefined()
	})
})

describe("resolveLocale", () => {
	it("takes the URL first, then the stored choice, then the browser, then the fallback", () => {
		const browser = ["fr-CH", "de-CH", "en"]
		expect(
			resolveLocale({ url: "en", stored: "de", browser }, available, "en"),
		).toBe("en")
		expect(
			resolveLocale({ url: "xx", stored: "de", browser }, available, "en"),
		).toBe("de")
		expect(resolveLocale({ browser }, available, "en")).toBe("de")
		expect(resolveLocale({ browser: ["fr", "it"] }, available, "en")).toBe("en")
		expect(resolveLocale({}, available, "en")).toBe("en")
	})
})

describe("resolveReadingLevel", () => {
	const levels = ["simple", "standard", "advanced"]

	it("takes a known URL level, then the stored one, then the fallback", () => {
		expect(
			resolveReadingLevel(
				{ url: "simple", stored: "advanced" },
				levels,
				"standard",
			),
		).toBe("simple")
		expect(
			resolveReadingLevel(
				{ url: "kids", stored: "advanced" },
				levels,
				"standard",
			),
		).toBe("advanced")
		expect(resolveReadingLevel({ stored: "nope" }, levels, "standard")).toBe(
			"standard",
		)
	})
})

describe("formattingLocale", () => {
	it("uses the browser's region of the same language", () => {
		expect(formattingLocale("de", ["de-CH", "en"])).toBe("de-CH")
		expect(formattingLocale("de", ["en-US", "de-AT"])).toBe("de-AT")
	})

	it("stays with the locale when the browser prefers the bare language or another one", () => {
		expect(formattingLocale("de", ["de", "de-CH"])).toBe("de")
		expect(formattingLocale("de", ["en-US"])).toBe("de")
		expect(formattingLocale("en", ["de-CH"])).toBe("en")
		expect(formattingLocale("en", [])).toBe("en")
	})
})

describe("localeChain", () => {
	it("goes from the most specific shipped locale to the fallback", () => {
		expect(localeChain("de", available, "en")).toEqual(["de", "en"])
		expect(localeChain("en", available, "en")).toEqual(["en"])
		expect(localeChain("de-CH", ["en", "de", "de-CH"], "en")).toEqual([
			"de-CH",
			"de",
			"en",
		])
	})
})
