/**
 * Named moments to travel to (issue #14): events a class knows or can look up,
 * each at an instant where the scene shows something worth pointing at. The
 * names and the one-line "what to look for" live in the locales under
 * `solarSystem.time.moments.<id>`; this list holds only the instants, so a new
 * moment is one line here plus its text.
 *
 * Instants are UTC and Gregorian (every one is after 1582). Guided tours (#28)
 * and the birthday feature (#26) travel with `travelAndStop` (./timeTravel.ts)
 * and may reuse these ids.
 */
import { dateToJD } from "@/sim"

export interface Moment {
	/** Key under `solarSystem.time.moments` in every locale. */
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

const INSTANTS: Record<MomentId, string> = {
	// Galileo sees three "stars" beside Jupiter from Padua, evening of 7 January 1610
	galileoMoons: "1610-01-07T18:00:00Z",
	// William Herschel spots Uranus from Bath, night of 13 March 1781
	uranusFound: "1781-03-13T22:00:00Z",
	// Johann Galle finds Neptune in Berlin, close to Le Verrier's prediction
	neptuneFound: "1846-09-23T22:00:00Z",
	// Sputnik 1 launch
	sputnik: "1957-10-04T19:28:00Z",
	// Apollo 11's Eagle touches down
	moonLanding: "1969-07-20T20:17:00Z",
	// Voyager 2 launch, the Grand Tour alignment of the giant planets
	voyagerLaunch: "1977-08-20T14:29:00Z",
	// Voyager 2's closest approach to Neptune
	voyagerNeptune: "1989-08-25T03:56:00Z",
	// Mars closest to Earth in almost 60,000 years (55.76 million km)
	marsClosest: "2003-08-27T09:51:00Z",
	// mid-transit of Venus across the Sun
	venusTransit: "2012-06-06T01:29:00Z",
	// Jupiter and Saturn 0.1° apart in the sky, closest since 1623
	greatConjunction: "2020-12-21T18:20:00Z",
	// the next transit of Venus, mid-transit
	nextVenusTransit: "2117-12-11T02:48:00Z",
}

/** Every moment, earliest first. */
export const MOMENTS: readonly Moment[] = MOMENT_IDS.map((id) => ({
	id,
	iso: INSTANTS[id],
}))

/** The moment's instant as a Julian Date. */
export const momentJD = (moment: Moment): number =>
	dateToJD(new Date(moment.iso))
