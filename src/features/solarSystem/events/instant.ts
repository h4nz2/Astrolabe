/**
 * The instant each sky event is shown at (#41): the one where the app's own
 * simulation shows it best (`bestInstant`, src/sim/skyEvents.ts), found once
 * per event and kept. The real instant is only for the words.
 */
import { bodies } from "@/data"
import { skyEventById, type SkyEvent } from "@/data/skyEvents"
import { dateToJD } from "@/sim"
import {
	SkyGeometry,
	bestInstant,
	earthObserverKm,
	measureEvent,
	type EventMeasure,
} from "@/sim/skyEvents"

let shared: SkyGeometry | null = null

/** The event geometry over the app's bodies (built on first use). */
export const skyGeometry = (): SkyGeometry =>
	(shared ??= new SkyGeometry(bodies))

const instants = new Map<string, number>()

/** The real instant of `event`, as a Julian Date. */
export const eventRealJD = (event: Pick<SkyEvent, "utc">): number =>
	dateToJD(new Date(event.utc))

/** The Julian Date the simulation shows `event` at. */
export function eventJD(event: SkyEvent): number {
	let jd = instants.get(event.id)
	if (jd === undefined) {
		jd = bestInstant(skyGeometry(), event.check, eventRealJD(event))
		instants.set(event.id, jd)
	}
	return jd
}

/** The same by id; null for an unknown event. */
export const eventJDById = (id: string): number | null => {
	const event = skyEventById.get(id)
	return event === undefined ? null : eventJD(event)
}

/** What the geometry sees at the event's instant (the shadow's place, the separation, ...). */
export const eventMeasure = (event: SkyEvent): EventMeasure =>
	measureEvent(skyGeometry(), event.check, eventJD(event))

/**
 * Where an observer on the Earth stands to watch `target` at `jd`; at an
 * event's instant, where the event is seen best (see `earthObserverKm`).
 */
export const observerKm = (
	target: string,
	jd: number,
	event?: SkyEvent,
): [number, number, number] =>
	earthObserverKm(skyGeometry(), target, jd, event?.check)
