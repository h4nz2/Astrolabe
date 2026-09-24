import { describe, expect, it } from "vitest"

import { normalizeName, slug } from "./names"

describe("slug", () => {
	it("turns English display names into lowercase ascii ids", () => {
		expect(slug("Sun")).toBe("sun")
		expect(slug("Moon")).toBe("moon")
		expect(slug("Io")).toBe("io")
		expect(slug("S/2003 J 24")).toBe("s2003j24")
		expect(slug("S/2004 S 22")).toBe("s2004s22")
	})

	it("strips diacritics and punctuation", () => {
		expect(slug("Rhéa")).toBe("rhea")
		expect(slug("Égéon")).toBe("egeon")
		expect(slug(" O'Neill-Prime ")).toBe("oneillprime")
	})

	it("refuses names that leave nothing behind", () => {
		expect(() => slug("???")).toThrow(/slug/)
		expect(() => slug("")).toThrow()
	})
})

describe("normalizeName", () => {
	it("makes accented French spellings equal to the English ones", () => {
		const pairs: Array<[string, string]> = [
			["Rhéa", "Rhea"],
			["Téthys", "Tethys"],
			["Dioné", "Dione"],
			["Hélène", "Helene"],
			["Pallène", "Pallene"],
			["Méthone", "Methone"],
			["Hypérion", "Hyperion"],
		]
		for (const [french, english] of pairs) {
			expect(normalizeName(french)).toBe(normalizeName(english))
		}
	})

	it("ignores case, whitespace and punctuation", () => {
		expect(normalizeName(" S/2003 J 24 ")).toBe("s2003j24")
		expect(normalizeName("MEGACLITE")).toBe(normalizeName("Megaclite"))
		expect(normalizeName("")).toBe("")
	})

	it("does not invent matches between different names", () => {
		expect(normalizeName("Épiméthée")).not.toBe(normalizeName("Epimetheus"))
		expect(normalizeName("Anthée")).not.toBe(normalizeName("Anthe"))
	})
})
