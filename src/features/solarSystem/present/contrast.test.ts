import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { contrastRatio, over, parseHex, type Rgb } from "./contrast"

const css = (file: string) =>
	readFileSync(new URL(file, import.meta.url), "utf8")

/** The `--name: #hex` tokens of the high-contrast block in presentation.css. */
const tokens = (() => {
	const text = css("./presentation.css")
	const block = text.slice(
		text.indexOf('html[data-contrast="high"][data-mantine-color-scheme]'),
	)
	const body = block.slice(0, block.indexOf("}"))
	return Object.fromEntries(
		Array.from(body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g), (m) => [
			m[1],
			parseHex(m[2]),
		]),
	) as Record<string, Rgb>
})()

const BLACK = parseHex("#000")
const WHITE = parseHex("#fff")
/** AAA for normal text: what a washed-out projector needs. */
const AAA = 7

describe("high contrast (#29)", () => {
	it("defines the tokens it is tested on", () => {
		for (const name of [
			"mantine-color-text",
			"mantine-color-dimmed",
			"mantine-color-placeholder",
			"mantine-color-body",
			"mantine-color-orange-filled",
			"mantine-color-orange-filled-hover",
			"mantine-color-orange-light-color",
			"mantine-primary-color-filled",
		]) {
			expect(tokens[name], name).toBeDefined()
		}
	})

	it("text, dimmed text and placeholders on the black panels reach AAA", () => {
		const body = tokens["mantine-color-body"]
		for (const name of [
			"mantine-color-text",
			"mantine-color-dimmed",
			"mantine-color-placeholder",
			"mantine-color-orange-light-color",
			"mantine-color-orange-text",
			"mantine-color-default-color",
		]) {
			expect(contrastRatio(tokens[name], body), name).toBeGreaterThanOrEqual(
				AAA,
			)
		}
	})

	it("white text on the filled orange (pressed buttons, switches) reaches AAA", () => {
		for (const name of [
			"mantine-color-orange-filled",
			"mantine-color-orange-filled-hover",
			"mantine-primary-color-filled",
		]) {
			expect(contrastRatio(WHITE, tokens[name]), name).toBeGreaterThanOrEqual(
				AAA,
			)
		}
	})

	it("the focus ring stands out from black (non-text: 3:1)", () => {
		const ring = /outline:\s*3px solid (#[0-9a-fA-F]{6})/.exec(
			css("./presentation.css"),
		)?.[1]
		expect(ring).toBeDefined()
		expect(contrastRatio(parseHex(ring!), BLACK)).toBeGreaterThanOrEqual(3)
	})

	it("labels on their dark plate stay AAA even over a white planet face", () => {
		const labels = css("../labels/Labels.module.css")
		const high = labels.slice(labels.indexOf('html[data-contrast="high"]'))
		const plate = /background:\s*rgba\(0, 0, 0, ([\d.]+)\)/.exec(high)
		expect(plate).not.toBeNull()
		const worst = over(BLACK, Number(plate![1]), WHITE)
		const colours = Array.from(
			high.matchAll(/color:\s*(#[0-9a-fA-F]{3,6})/g),
			(m) => m[1],
		)
		expect(colours.length).toBeGreaterThanOrEqual(3)
		for (const colour of colours) {
			expect(
				contrastRatio(parseHex(colour), worst),
				colour,
			).toBeGreaterThanOrEqual(AAA)
		}
	})
})

describe("contrastRatio", () => {
	it("matches the WCAG reference values", () => {
		expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 5)
		expect(contrastRatio(BLACK, BLACK)).toBe(1)
		expect(contrastRatio(parseHex("#767676"), WHITE)).toBeCloseTo(4.54, 2)
	})
})
