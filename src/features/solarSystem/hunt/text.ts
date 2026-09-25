/**
 * The words of the scavenger hunt (#34), per locale and reading level:
 * `src/locales/<locale>/hunts.json`, like the body content of `@/i18n/bodies`.
 *
 * ```
 * hunts.<huntId>        { title, description }
 * questions.<questionId> { clue, hints[], found }
 * ```
 *
 * Every text field is one value for all reading levels or one per level (the
 * default level required), plain text, not ICU. Lookup walks the locale chain
 * (de -> en); within a locale the reading level wins.
 */
import { z } from "zod"

import type { I18n, Locale } from "@/i18n"
import { leveled, pickLevel } from "@/i18n/bodies"

const text = z.string().trim().min(1)

export const HuntTextEntry = z
	.object({ title: leveled(text), description: leveled(text) })
	.strict()

export const QuestionTextEntry = z
	.object({
		/** The clue, a riddle about the world to find. */
		clue: leveled(text),
		/** Escalating hints, gentlest first; the last one names the world and how to reach it. */
		hints: leveled(z.array(text).min(1)),
		/** What the class learns once it is found. */
		found: leveled(text),
	})
	.strict()

export const HuntTextFile = z
	.object({
		hunts: z.record(z.string(), HuntTextEntry),
		questions: z.record(z.string(), QuestionTextEntry),
	})
	.strict()
export type HuntTextFile = z.infer<typeof HuntTextFile>

const modules = import.meta.glob<HuntTextFile>(
	"../../../locales/*/hunts.json",
	{
		eager: true,
		import: "default",
	},
)

/** The hunts' words by locale (cast; hunts.test.ts validates every file). */
export const huntText: ReadonlyMap<Locale, HuntTextFile> = new Map(
	Object.entries(modules).map(([path, file]) => [
		path.replace(/^.*\/locales\//, "").replace(/\/hunts\.json$/, ""),
		file,
	]),
)

function lookup<T>(
	i18n: Pick<I18n, "chain" | "readingLevel">,
	read: (file: HuntTextFile) => unknown,
): T | undefined {
	for (const locale of i18n.chain) {
		const file = huntText.get(locale)
		if (file === undefined) continue
		const value = pickLevel<T>(read(file) as T | undefined, i18n.readingLevel)
		if (value !== undefined) return value
	}
	return undefined
}

export interface QuestionText {
	clue: string
	hints: readonly string[]
	found: string
}

/** A clue's words in the active language and reading level. */
export const questionText = (
	id: string,
	i18n: Pick<I18n, "chain" | "readingLevel">,
): QuestionText => ({
	clue: lookup<string>(i18n, (file) => file.questions[id]?.clue) ?? id,
	hints: lookup<string[]>(i18n, (file) => file.questions[id]?.hints) ?? [],
	found: lookup<string>(i18n, (file) => file.questions[id]?.found) ?? "",
})

export interface HuntTitle {
	title: string
	description: string
}

/** A ready-made hunt's title and one-line description. */
export const huntTitle = (
	id: string,
	i18n: Pick<I18n, "chain" | "readingLevel">,
): HuntTitle => ({
	title: lookup<string>(i18n, (file) => file.hunts[id]?.title) ?? id,
	description:
		lookup<string>(i18n, (file) => file.hunts[id]?.description) ?? "",
})
