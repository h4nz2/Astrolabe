/**
 * Named moments (issue #14), now part of the sky events list (#41: one list,
 * not two). The moments are the events with these ids in
 * `src/data/skyEvents.json` (the `history` group, plus the transit, the
 * conjunction and the close approach that were moments before); their words
 * are the events' (`src/locales/<locale>/events.json`) and choosing one in the
 * app stages the event with its viewpoint (`features/solarSystem/events`).
 *
 * Kept for guided tours (#28), whose stops may travel to `{ "moment": id }`:
 * that is the moment's real instant. `{ "event": id }` is the instant the
 * simulation shows it best.
 */
import { skyEventById } from "@/data/skyEvents"
import { dateToJD } from "@/sim"

export interface Moment {
	/** The id of the sky event. */
	id: MomentId
	/** The instant, ISO 8601 in UTC. */
	iso: string
}

export const MOMENT_IDS = [
	"galileoMoons",
	"uranusFound",
	"neptuneFound",
	"sputnik",
	"moonLanding",
	"voyagerLaunch",
	"voyagerNeptune",
	"marsClosest",
	"venusTransit",
	"greatConjunction",
	"nextVenusTransit",
] as const

export type MomentId = (typeof MOMENT_IDS)[number]

/** Every moment, earliest first. */
export const MOMENTS: readonly Moment[] = MOMENT_IDS.map((id) => ({
	id,
	iso: skyEventById.get(id)?.utc ?? "2000-01-01T12:00:00Z",
}))

/** The moment's instant as a Julian Date. */
export const momentJD = (moment: Moment): number =>
	dateToJD(new Date(moment.iso))
