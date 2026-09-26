/**
 * Sky events (#41): the curated list in `src/data/skyEvents.json`, grouped by
 * kind. An event is a real instant (UTC, the time the text gives) plus the
 * check that says what must be seen: `src/sim/skyEvents.ts` finds the instant
 * where the app's own simulation shows it best and `skyEvents.test.ts` proves
 * that every listed event really happens there. An event the simulation cannot
 * reproduce is not listed.
 *
 * The named moments of #14 are part of this list (the `history` group and the
 * events with the old moment ids), so there is one list, not two;
 * `features/solarSystem/ui/moments.ts` reads them from here.
 *
 * How an event is staged (time, scale, the view from space and from Earth)
 * follows from its check (`features/solarSystem/events/staging.ts`); the few
 * `space` / `earth` fields here are for events whose check does not say what
 * to look at (discoveries and missions). The words are in
 * `src/locales/<locale>/events.json`.
 */
import { z } from "zod"

import type { EventCheck } from "@/sim/skyEvents"

import eventsJson from "./skyEvents.json"

/** The groups of the list, in the order they are shown. */
export const EVENT_GROUPS = [
	"solarEclipse",
	"lunarEclipse",
	"transit",
	"gathering",
	"closeApproach",
	"shadowsRings",
	"history",
] as const
export type EventGroup = (typeof EVENT_GROUPS)[number]

const bodyId = z.string().min(1)

const Check = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("solarEclipse"),
			type: z.enum(["total", "annular"]),
		})
		.strict(),
	z
		.object({
			kind: z.literal("lunarEclipse"),
			type: z.enum(["total", "partial"]),
		})
		.strict(),
	z.object({ kind: z.literal("transit"), body: bodyId }).strict(),
	z
		.object({
			kind: z.literal("conjunction"),
			bodies: z.tuple([bodyId, bodyId]),
			maxDeg: z.number().positive(),
		})
		.strict(),
	z
		.object({
			kind: z.literal("gathering"),
			bodies: z.array(bodyId).min(2),
			maxSpanDeg: z.number().positive().max(180),
		})
		.strict(),
	z
		.object({
			kind: z.literal("closestApproach"),
			body: bodyId,
			distanceKm: z.number().positive(),
		})
		.strict(),
	z.object({ kind: z.literal("moonShadow"), moon: bodyId }).strict(),
	z.object({ kind: z.literal("ringPlaneCrossing"), body: bodyId }).strict(),
	z
		.object({
			kind: z.literal("visible"),
			body: bodyId,
			minElongationDeg: z.number().min(0).max(180),
		})
		.strict(),
	z.object({ kind: z.literal("moment") }).strict(),
])

export const SkyEventSchema = z
	.object({
		/** Letters and digits; the key of the event's words and of its link (`?event=<id>`). */
		id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
		group: z.enum(EVENT_GROUPS),
		/** The real instant, ISO 8601 UTC (greatest eclipse, mid-transit, closest approach...). */
		utc: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/),
		check: Check,
		/** The view from space, for events whose check does not say (a body, a region of `fitAu` round the Sun, a spacecraft to show). */
		space: z
			.object({
				body: bodyId.optional(),
				fitAu: z.number().positive().optional(),
				craft: z.string().optional(),
			})
			.strict()
			.optional(),
		/** The view from Earth: a telescope on `body` with a field of `fovDeg` degrees. */
		earth: z
			.object({ body: bodyId, fovDeg: z.number().positive().max(120) })
			.strict()
			.optional(),
	})
	.strict()

export type SkyEvent = z.infer<typeof SkyEventSchema> & {
	readonly check: EventCheck
}

/** The file as it is, unvalidated (for the tests). */
export const skyEventsFile: unknown = eventsJson

/** Every event, in the file's order (by group, then by date); `skyEvents.test.ts` validates the file. */
export const SKY_EVENTS: readonly SkyEvent[] =
	eventsJson as unknown as SkyEvent[]

export const skyEventById: ReadonlyMap<string, SkyEvent> = new Map(
	SKY_EVENTS.map((event) => [event.id, event]),
)

/** The events of one group, earliest first. */
export const eventsInGroup = (group: EventGroup): SkyEvent[] =>
	SKY_EVENTS.filter((event) => event.group === group).sort((a, b) =>
		a.utc.localeCompare(b.utc),
	)

/** The real instant of an event as a `Date`. */
export const eventDate = (event: Pick<SkyEvent, "utc">): Date =>
	new Date(event.utc)

/**
 * A sky event plays as a guided tour (#28) with one stop per view; its id in
 * the tour player and in links (`?tour=event-solar2024&stop=2`).
 */
export const EVENT_TOUR_PREFIX = "event-"

export const eventTourId = (id: string): string => `${EVENT_TOUR_PREFIX}${id}`

/** The event a tour id stands for, or null when it is not an event's. */
export const eventOfTourId = (tourId: string): SkyEvent | null =>
	tourId.startsWith(EVENT_TOUR_PREFIX)
		? (skyEventById.get(tourId.slice(EVENT_TOUR_PREFIX.length)) ?? null)
		: null
