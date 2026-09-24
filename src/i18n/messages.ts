/**
 * Message lookup and ICU formatting (pure, no React).
 *
 * A locale's `ui.json` is a tree of ICU MessageFormat strings. A key may carry
 * reading-level variants as sibling keys with an `@<level>` suffix:
 *
 *   "orbitalPeriod": "Orbital period",           <- default level, and every level without its own text
 *   "orbitalPeriod@simple": "Time for one lap"   <- only for the "simple" reading level
 *
 * Lookup order for (locale, level): the locale chain (e.g. de-CH, de, en), and in
 * each locale the level's variant before the plain text. Language wins over level:
 * a German reader on "simple" gets German standard text before English simple text.
 */
import { IntlMessageFormat } from "intl-messageformat"

/** Separates a message key from its reading level: `key@simple`. */
export const LEVEL_SEPARATOR = "@"

export type MessageTree = { readonly [key: string]: string | MessageTree }

/** Flat `dotted.key[@level]` -> ICU text, per locale. */
export type FlatMessages = ReadonlyMap<string, string>

/** Values a message can interpolate; plurals and `number` need numbers. */
export type MessageValues = Readonly<
	Record<string, string | number | boolean | Date | null | undefined>
>

/** Flattens a message tree into dotted keys; `@level` suffixes stay on the last segment. */
export function flattenMessages(
	tree: MessageTree,
	prefix = "",
	out: Map<string, string> = new Map(),
): Map<string, string> {
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix === "" ? key : `${prefix}.${key}`
		if (typeof value === "string") out.set(path, value)
		else flattenMessages(value, path, out)
	}
	return out
}

/** `"a.b@simple"` -> `["a.b", "simple"]`, `"a.b"` -> `["a.b", undefined]`. */
export function splitLevel(flatKey: string): [string, string | undefined] {
	const at = flatKey.lastIndexOf(LEVEL_SEPARATOR)
	return at === -1
		? [flatKey, undefined]
		: [flatKey.slice(0, at), flatKey.slice(at + 1)]
}

export interface FoundMessage {
	text: string
	/** The locale the text was found in (the chain may have fallen back). */
	locale: string
}

/** The text for `key` at `level`, walking `chain` (most specific locale first). */
export function lookupMessage(
	catalog: ReadonlyMap<string, FlatMessages>,
	chain: readonly string[],
	key: string,
	level: string,
	defaultLevel: string,
): FoundMessage | undefined {
	for (const locale of chain) {
		const messages = catalog.get(locale)
		if (messages === undefined) continue
		if (level !== defaultLevel) {
			const leveled = messages.get(`${key}${LEVEL_SEPARATOR}${level}`)
			if (leveled !== undefined) return { text: leveled, locale }
		}
		const text = messages.get(key)
		if (text !== undefined) return { text, locale }
	}
	return undefined
}

/** Options every compiled message uses (also what the resource tests parse with). */
export const MESSAGE_FORMAT_OPTIONS = { ignoreTag: true } as const

const compiled = new Map<string, IntlMessageFormat>()

/** A compiled message, cached per (formatting locale, text). Throws on ICU syntax errors. */
export function compileMessage(
	text: string,
	formatLocale: string,
): IntlMessageFormat {
	const cacheKey = `${formatLocale}\u0000${text}`
	let message = compiled.get(cacheKey)
	if (message === undefined) {
		message = new IntlMessageFormat(
			text,
			formatLocale,
			undefined,
			MESSAGE_FORMAT_OPTIONS,
		)
		compiled.set(cacheKey, message)
	}
	return message
}

/** Formats `text` with `values`; `undefined` when the text is broken or a value is missing. */
export function formatMessage(
	text: string,
	formatLocale: string,
	values?: MessageValues,
): string | undefined {
	try {
		const result = compileMessage(text, formatLocale).format(
			values as Record<string, string | number | boolean | Date>,
		)
		return Array.isArray(result) ? result.join("") : String(result)
	} catch {
		return undefined
	}
}
