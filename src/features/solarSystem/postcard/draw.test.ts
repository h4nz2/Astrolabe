import { describe, expect, it } from "vitest"

import { clampLines, fitLine, postcardUnit, rowColumns, wrapText } from "./draw"

// a monospace ruler: every character is 10 px wide
const measure = (text: string) => text.length * 10

describe("postcard layout", () => {
	it("sizes everything from the picture's size", () => {
		expect(postcardUnit(1920, 1080)).toBeCloseTo(1080 / 34)
		// a tall phone picture: the long side keeps the text legible
		expect(postcardUnit(780, 1688)).toBeCloseTo(1688 / 62)
		expect(postcardUnit(10, 10)).toBe(8)
	})

	it("sets extra facts in 4 columns beside a landscape picture, 2 below a portrait one", () => {
		expect(rowColumns(1920, 1080, 8)).toBe(4)
		expect(rowColumns(780, 1688, 8)).toBe(2)
		expect(rowColumns(1920, 1080, 1)).toBe(1)
		expect(rowColumns(1920, 1080, 0)).toBe(1)
	})

	it("wraps words into lines that fit", () => {
		expect(wrapText(measure, "the  giant of the solar system", 100)).toEqual([
			"the giant",
			"of the",
			"solar",
			"system",
		])
		expect(wrapText(measure, "", 100)).toEqual([])
		// a word longer than a line stays whole
		expect(wrapText(measure, "Kallisto-Umlaufbahn x", 100)).toEqual([
			"Kallisto-Umlaufbahn",
			"x",
		])
	})

	it("cuts text that does not fit with an ellipsis", () => {
		expect(fitLine(measure, "Mars", 100)).toBe("Mars")
		expect(fitLine(measure, "Ganymede and Callisto", 100)).toBe("Ganymede…")
		expect(clampLines(measure, ["one", "two", "three"], 2, 100)).toEqual([
			"one",
			"two…",
		])
		expect(clampLines(measure, ["one", "two"], 2, 100)).toEqual(["one", "two"])
	})
})
