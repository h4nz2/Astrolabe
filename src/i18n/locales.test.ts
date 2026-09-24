/**
 * The contract every translation resource must keep. These tests are what make
 * "add a locale" and "add a reading level" data-only changes: a contributor edits
 * JSON and this file tells them exactly what is missing or wrong.
 */
import { describe, expect, it } from "vitest"

import config from "@/locales/config.json"

import {
	catalog,
	DEFAULT_LOCALE,
	DEFAULT_READING_LEVEL,
	LOCALES,
	READING_LEVELS,
	messageTrees,
} from "./catalog"
import { compileMessage, splitLevel } from "./messages"

type AstNode = {
	type: number
	value?: string
	pluralType?: "cardinal" | "ordinal"
	options?: Record<string, { value: AstNode[] }>
	children?: AstNode[]
}

// @formatjs/icu-messageformat-parser TYPE enum
const ARGUMENT_TYPES = new Set([1, 2, 3, 4, 5, 6])
const SELECT = 5
const PLURAL = 6
const TAG = 8

interface MessageShape {
	args: Set<string>
	/** Plural arguments with the categories they cover. */
	plurals: { arg: string; ordinal: boolean; keys: string[] }[]
}

function shapeOf(text: string, locale: string): MessageShape {
	const shape: MessageShape = { args: new Set(), plurals: [] }
	const walk = (nodes: AstNode[]) => {
		for (const node of nodes) {
			if (ARGUMENT_TYPES.has(node.type) && node.value)
				shape.args.add(node.value)
			if (node.type === PLURAL && node.value && node.options) {
				shape.plurals.push({
					arg: node.value,
					ordinal: node.pluralType === "ordinal",
					keys: Object.keys(node.options),
				})
			}
			if ((node.type === PLURAL || node.type === SELECT) && node.options) {
				for (const option of Object.values(node.options)) walk(option.value)
			}
			if (node.type === TAG && node.children) walk(node.children)
		}
	}
	walk(compileMessage(text, locale).getAst() as unknown as AstNode[])
	return shape
}

const reference = catalog.get(DEFAULT_LOCALE)!

/** Arguments the code passes for a key: the union over the reference's level variants. */
const referenceArgs = new Map<string, Set<string>>()
for (const [flatKey, text] of reference) {
	const [key] = splitLevel(flatKey)
	const args = referenceArgs.get(key) ?? new Set<string>()
	for (const arg of shapeOf(text, DEFAULT_LOCALE).args) args.add(arg)
	referenceArgs.set(key, args)
}

describe("src/locales/config.json", () => {
	it("names a shipped fallback locale", () => {
		expect(LOCALES).toContain(config.defaultLocale)
		expect(LOCALES[0]).toBe(config.defaultLocale)
	})

	it("lists unique reading levels and a default among them", () => {
		expect(new Set(READING_LEVELS).size).toBe(READING_LEVELS.length)
		expect(READING_LEVELS).toContain(DEFAULT_READING_LEVEL)
	})

	it("names every reading level in the reference file, in menu order", () => {
		const tree = messageTrees.get(DEFAULT_LOCALE) as {
			i18n: { readingLevel: Record<string, unknown> }
		}
		expect(Object.keys(tree.i18n.readingLevel)).toEqual([...READING_LEVELS])
	})
})

describe.each(LOCALES)("locale %s", (locale) => {
	const messages = catalog.get(locale)!

	it("has exactly the reference keys, level variants included", () => {
		const missing = [...reference.keys()].filter((key) => !messages.has(key))
		const extra = [...messages.keys()].filter((key) => !reference.has(key))
		expect({ missing, extra }).toEqual({ missing: [], extra: [] })
	})

	it("only uses known, non-default reading levels as @suffixes", () => {
		const bad = [...messages.keys()].filter((key) => {
			const [, level] = splitLevel(key)
			return (
				level !== undefined &&
				(level === DEFAULT_READING_LEVEL ||
					!(READING_LEVELS as readonly string[]).includes(level))
			)
		})
		expect(bad).toEqual([])
	})

	it("has no empty messages", () => {
		const empty = [...messages].filter(([, text]) => text.trim() === "")
		expect(empty.map(([key]) => key)).toEqual([])
	})

	it("parses as ICU MessageFormat and uses only the arguments the code passes", () => {
		const problems: string[] = []
		for (const [flatKey, text] of messages) {
			const [key] = splitLevel(flatKey)
			let shape: MessageShape
			try {
				shape = shapeOf(text, locale)
			} catch (error) {
				problems.push(`${flatKey}: ${(error as Error).message}`)
				continue
			}
			const allowed = referenceArgs.get(key) ?? new Set()
			for (const arg of shape.args) {
				if (!allowed.has(arg)) problems.push(`${flatKey}: unknown {${arg}}`)
			}
		}
		expect(problems).toEqual([])
	})

	it("gives every plural all the categories of the language's plural rules", () => {
		const cardinal = new Intl.PluralRules(locale).resolvedOptions()
			.pluralCategories
		const ordinal = new Intl.PluralRules(locale, {
			type: "ordinal",
		}).resolvedOptions().pluralCategories
		const problems: string[] = []
		for (const [flatKey, text] of messages) {
			for (const plural of shapeOf(text, locale).plurals) {
				const required = plural.ordinal ? ordinal : cardinal
				const missing = required.filter(
					(category) => !plural.keys.includes(category),
				)
				if (missing.length > 0) {
					problems.push(
						`${flatKey}: {${plural.arg}} lacks ${missing.join(", ")}`,
					)
				}
			}
		}
		expect(problems).toEqual([])
	})
})
