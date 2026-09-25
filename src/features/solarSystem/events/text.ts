/**
 * The words of the sky events (#41), per locale and reading level:
 * `src/locales/<locale>/events.json`, like the hunts' and the tours' words.
 *
 * ```
 * <eventId> { title, where, look }
 * ```
 *
 * `title` names the event ("Total solar eclipse"), `where` says where on
 * Earth it could be seen, `look` is the short "what to look for". Each is one
 * value for all reading levels or one per level (the default level required),
 * plain text, not ICU. Lookup walks the locale chain; within a locale the
 * reading level wins. Dates and times are formatted by the app, never written
 * into the words.
 */
import { useMemo } from "react"
import { z } from "zod"

import { useI18n, type I18n, type Locale } from "@/i18n"
import { leveled, pickLevel } from "@/i18n/bodies"

const text = z.string().trim().min(1)

export const EventTextEntry = z
	.object({
		title: leveled(text),
		where: leveled(text),
		look: leveled(text),
	})
	.strict()

export const EventTextFile = z.record(z.string(), EventTextEntry)
export type EventTextFile = z.infer<typeof EventTextFile>

const modules = import.meta.glob<EventTextFile>(
	"../../../locales/*/events.json",
	{ eager: true, import: "default" },
)

/** The events' words by locale (cast; skyEventsText.test.ts validates every file). */
export const eventText: ReadonlyMap<Locale, EventTextFile> = new Map(
	Object.entries(modules).map(([path, file]) => [
		path.replace(/^.*\/locales\//, "").replace(/\/events\.json$/, ""),
		file,
	]),
)

export interface EventWords {
	title: string
	where: string
	look: string
}

type Field = keyof EventWords

function lookup(
	i18n: Pick<I18n, "chain" | "readingLevel">,
	id: string,
	field: Field,
): string {
	for (const locale of i18n.chain) {
		const value = eventText.get(locale)?.[id]?.[field]
		const picked = pickLevel<string>(value, i18n.readingLevel)
		if (picked !== undefined) return picked
	}
	return field === "title" ? id : ""
}

/** An event's words in the active language and reading level. */
export const eventWords = (
	id: string,
	i18n: Pick<I18n, "chain" | "readingLevel">,
): EventWords => ({
	title: lookup(i18n, id, "title"),
	where: lookup(i18n, id, "where"),
	look: lookup(i18n, id, "look"),
})

/** `eventWords` bound to the active language and reading level. */
export function useEventWords(): (id: string) => EventWords {
	const { chain, readingLevel } = useI18n()
	return useMemo(
		() => (id: string) => eventWords(id, { chain, readingLevel }),
		[chain, readingLevel],
	)
}
