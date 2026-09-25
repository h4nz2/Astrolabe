/**
 * Editorial spacecraft content (issue #35): translated names, taglines and
 * descriptions at every reading level, from `src/locales/<locale>/spacecraft.json`,
 * keyed by the craft id of src/data/spacecraft.json. The same shape and
 * fallbacks as body content (./bodies.ts): a text field is one value for every
 * level or one per level, the locale chain is walked before the default level
 * of a locale is used.
 */
import { useMemo } from "react"
import { z } from "zod"

import { leveled, pickLevel } from "./bodies"
import type { Locale } from "./catalog"
import { useI18n } from "./context"
import type { I18n } from "./core"

const text = z.string().trim().min(1)

/** One craft's entry in a locale's spacecraft.json. */
export const SpacecraftContent = z
	.object({
		/** The mission's name in this language ("James-Webb-Weltraumteleskop"). */
		name: text,
		/** A few words: "The most distant human-made object". */
		tagline: leveled(text),
		/** A short paragraph: what it is, what it did, where it is going. */
		description: leveled(text),
	})
	.strict()

export const SpacecraftContentFile = z.record(z.string(), SpacecraftContent)

export type SpacecraftContent = z.infer<typeof SpacecraftContent>
export type SpacecraftContentFile = z.infer<typeof SpacecraftContentFile>

const modules = import.meta.glob<SpacecraftContentFile>(
	"../locales/*/spacecraft.json",
	{ eager: true, import: "default" },
)

/** Spacecraft content by locale (cast; the resource tests validate it). */
export const spacecraftContent: ReadonlyMap<Locale, SpacecraftContentFile> =
	new Map(
		Object.entries(modules).map(([path, file]) => [
			path.replace(/^.*\/locales\//, "").replace(/\/spacecraft\.json$/, ""),
			file,
		]),
	)

/** A craft's name along the locale chain; the id when no locale names it. */
export function spacecraftName(id: string, chain: readonly Locale[]): string {
	for (const locale of chain) {
		const name = spacecraftContent.get(locale)?.[id]?.name
		if (name !== undefined) return name
	}
	return id
}

export interface SpacecraftText {
	id: string
	name: string
	tagline: string
	description: string
}

function field(
	id: string,
	key: "tagline" | "description",
	i18n: Pick<I18n, "chain" | "readingLevel">,
): string {
	for (const locale of i18n.chain) {
		const value = pickLevel<string>(
			spacecraftContent.get(locale)?.[id]?.[key],
			i18n.readingLevel,
		)
		if (value !== undefined) return value
	}
	return ""
}

/** Everything written about a craft, in the active language and reading level. */
export const getSpacecraftText = (
	id: string,
	i18n: Pick<I18n, "chain" | "readingLevel">,
): SpacecraftText => ({
	id,
	name: spacecraftName(id, i18n.chain),
	tagline: field(id, "tagline", i18n),
	description: field(id, "description", i18n),
})

export function useSpacecraftText(id: string): SpacecraftText {
	const i18n = useI18n()
	return useMemo(() => getSpacecraftText(id, i18n), [id, i18n])
}

/** A name lookup bound to the active language. */
export function useSpacecraftName(): (id: string) => string {
	const { chain } = useI18n()
	return useMemo(() => (id: string) => spacecraftName(id, chain), [chain])
}
