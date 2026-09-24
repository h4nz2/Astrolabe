/**
 * The translation resources, discovered from src/locales (docs/ARCHITECTURE.md, "i18n").
 *
 * Every folder `src/locales/<locale>/` with a `ui.json` is a shipped locale: adding
 * one is a data-only change. `src/locales/config.json` names the fallback locale,
 * the reading levels (in menu order) and the default level. English
 * (`src/locales/en/ui.json`) is the reference: its keys are the `MessageKey` type,
 * and the resource tests hold every other locale to exactly its keys.
 */
import config from "@/locales/config.json"
import type enMessages from "@/locales/en/ui.json"

import {
	flattenMessages,
	type FlatMessages,
	type MessageTree,
} from "./messages"

type Leaves<T, Prefix extends string = ""> = {
	[K in keyof T & string]: T[K] extends string
		? `${Prefix}${K}`
		: Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

/** Every message key of the English reference file, without `@level` variants. */
export type MessageKey = Exclude<
	Leaves<typeof enMessages>,
	`${string}@${string}`
>

/** The reading levels the English file names (`i18n.readingLevel.<id>`). */
export type ReadingLevel = keyof (typeof enMessages)["i18n"]["readingLevel"]

/** A locale id: the name of a folder in src/locales ("en", "de", later "fr", "de-CH"). */
export type Locale = string

const modules = import.meta.glob<MessageTree>("../locales/*/ui.json", {
	eager: true,
	import: "default",
})

const localeOf = (path: string): string =>
	path.replace(/^.*\/locales\//, "").replace(/\/ui\.json$/, "")

/** Raw message trees by locale (the resource tests read these). */
export const messageTrees: ReadonlyMap<Locale, MessageTree> = new Map(
	Object.entries(modules).map(([path, tree]) => [localeOf(path), tree]),
)

/** Flattened messages by locale. */
export const catalog: ReadonlyMap<Locale, FlatMessages> = new Map(
	[...messageTrees].map(([locale, tree]) => [locale, flattenMessages(tree)]),
)

export const DEFAULT_LOCALE: Locale = config.defaultLocale

/** Shipped locales, the default first, then alphabetical. */
export const LOCALES: readonly Locale[] = [...catalog.keys()].sort((a, b) =>
	a === DEFAULT_LOCALE ? -1 : b === DEFAULT_LOCALE ? 1 : a.localeCompare(b),
)

export const READING_LEVELS = config.readingLevels as readonly ReadingLevel[]

export const DEFAULT_READING_LEVEL = config.defaultReadingLevel as ReadingLevel

export const isReadingLevel = (value: unknown): value is ReadingLevel =>
	typeof value === "string" &&
	(READING_LEVELS as readonly string[]).includes(value)
