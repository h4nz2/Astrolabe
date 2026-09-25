/**
 * The words of the guided tours (#28): `src/locales/<locale>/tours.json`, keyed
 * by tour id, then stop id. Like the body content (`@/i18n/bodies`), every text
 * is plain (not ICU) and is either one string for all reading levels or one
 * per level (the default level required); lookup walks the locale chain, and
 * within a locale the reading level's text wins, then the default level's.
 */
import { useMemo } from "react"
import { z } from "zod"

import type { Tour, TourStop } from "@/data/tours"
import {
	DEFAULT_READING_LEVEL,
	READING_LEVELS,
	useI18n,
	type Locale,
} from "@/i18n"
import { pickLevel } from "@/i18n/bodies"

const levelIds = READING_LEVELS as readonly string[]
const text = z.string().trim().min(1)

/** One text, or one per reading level (the default level required). */
const leveled = z.union([
	text,
	z
		.record(z.string(), text)
		.refine((byLevel) => DEFAULT_READING_LEVEL in byLevel, {
			message: `a per-level text needs the default level "${DEFAULT_READING_LEVEL}"`,
		})
		.refine(
			(byLevel) => Object.keys(byLevel).every((l) => levelIds.includes(l)),
			{ message: `reading levels must be one of ${levelIds.join(", ")}` },
		),
])

export const StopText = z
	.object({
		/** A few words: the card's heading. */
		title: leveled,
		/** The narration: what to look at and why it matters. */
		text: leveled,
		/** The label of the stop's link button, when the stop has a `link`. */
		link: leveled.optional(),
	})
	.strict()

export const TourText = z
	.object({
		title: leveled,
		/** One sentence for the tour menu: the question the tour answers. */
		summary: leveled,
		stops: z.record(z.string(), StopText),
	})
	.strict()

/** A whole `tours.json`: tour id -> its words. */
export const ToursTextFile = z.record(z.string(), TourText)

export type TourTextFile = z.infer<typeof ToursTextFile>
type Leveled = z.infer<typeof leveled>

const modules = import.meta.glob<TourTextFile>(
	"../../../locales/*/tours.json",
	{
		eager: true,
		import: "default",
	},
)

/** Tour words by locale (validated by the tests, like bodies.json). */
export const tourContent: ReadonlyMap<Locale, TourTextFile> = new Map(
	Object.entries(modules).map(([path, file]) => [
		path.replace(/^.*\/locales\//, "").replace(/\/tours\.json$/, ""),
		file,
	]),
)

type Chain = readonly Locale[]

function lookup(
	chain: Chain,
	level: string,
	get: (file: TourTextFile) => Leveled | undefined,
): string {
	for (const locale of chain) {
		const file = tourContent.get(locale)
		const value = file === undefined ? undefined : get(file)
		const picked = pickLevel<string>(value, level)
		if (picked !== undefined) return picked
	}
	return ""
}

export interface TourWords {
	title: string
	summary: string
}

export interface StopWords {
	title: string
	text: string
	/** The link button's label ("" without one). */
	link: string
}

export const tourWords = (
	tourId: string,
	chain: Chain,
	level: string,
): TourWords => ({
	title: lookup(chain, level, (file) => file[tourId]?.title),
	summary: lookup(chain, level, (file) => file[tourId]?.summary),
})

export const stopWords = (
	tourId: string,
	stopId: string,
	chain: Chain,
	level: string,
): StopWords => ({
	title: lookup(chain, level, (file) => file[tourId]?.stops[stopId]?.title),
	text: lookup(chain, level, (file) => file[tourId]?.stops[stopId]?.text),
	link: lookup(chain, level, (file) => file[tourId]?.stops[stopId]?.link),
})

/** Words for a tour and its stops, bound to the active language and reading level. */
export function useTourWords() {
	const { chain, readingLevel } = useI18n()
	return useMemo(
		() => ({
			tour: (tour: Pick<Tour, "id">) => tourWords(tour.id, chain, readingLevel),
			stop: (tour: Pick<Tour, "id">, stop: Pick<TourStop, "id">) =>
				stopWords(tour.id, stop.id, chain, readingLevel),
		}),
		[chain, readingLevel],
	)
}
