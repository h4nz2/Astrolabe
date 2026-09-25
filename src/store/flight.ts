/**
 * Fly between planets (#18; docs/ARCHITECTURE.md, "Flights"): the named
 * transit profile of the three-phase flight (pull back, travel, descend) and
 * the record of the flight the readout talks about.
 *
 * A flight is an ordinary navigation request with `profile: FLIGHT_PROFILE`
 * (`setFocus` asks for one whenever the view moves from one body to another;
 * a tour step asks with `flightStep`). The camera rig executes it
 * (`camera/profiles.ts` `flightProfile`) and, when it departs, records here
 * where it goes, how far that is in TRUE kilometres and how long the move
 * takes, so the HUD can show the distance and the travel times without ever
 * reading the camera.
 *
 * Only the camera rig writes the record (`depart`, `transitionStarted`,
 * `arrive`); the readout reads it and may `dismiss` it.
 */
import { create } from "zustand"

import type { SequenceStep, View } from "./navigation"

/** The transit profile name of the flight (`ViewRequest.profile`). */
export const FLIGHT_PROFILE = "fly"

/** The flight the readout shows: the one running, or the one that brought the camera here. */
export interface Flight {
	/** Id of the transition carrying it. */
	readonly id: number
	/** The body the camera left (the body its pivot was attached to at departure). */
	readonly fromId: string
	readonly toId: string
	/** TRUE centre-to-centre distance at departure, km (never the drawn one). */
	readonly distanceKm: number
	/** `performance.now()` at departure, and the planned length of the move, ms. */
	readonly startedAt: number
	readonly durationMs: number
	/**
	 * Normalized time window in which the camera crosses the gap (eased in
	 * and out, see `travelledAt`): the readout's distance counter follows it.
	 */
	readonly travelStart: number
	readonly travelEnd: number
	/** The camera has arrived (or the flight was skipped). */
	readonly arrived: boolean
}

export type Departure = Omit<Flight, "arrived">

export interface FlightState {
	flight: Flight | null
	/** Camera rig: a flight left. */
	depart: (departure: Departure) => void
	/**
	 * Camera rig: some other transition started. A skip or a re-frame of the
	 * flight's destination keeps the record (arrived at once); anything else
	 * replaces the flight, so the readout goes.
	 */
	transitionStarted: (id: number, view: View) => void
	/** Camera rig: transition `id` arrived. */
	arrive: (id: number) => void
	/** The readout's close button. */
	dismiss: () => void
}

export const useFlightStore = create<FlightState>()((set, get) => ({
	flight: null,
	depart: (departure) => set({ flight: { ...departure, arrived: false } }),
	transitionStarted: (id, view) => {
		const { flight } = get()
		if (flight === null || flight.id === id) return
		if (view.kind === "body" && view.id === flight.toId) {
			if (!flight.arrived) set({ flight: { ...flight, arrived: true } })
		} else {
			set({ flight: null })
		}
	},
	arrive: (id) => {
		const { flight } = get()
		if (flight !== null && flight.id === id && !flight.arrived) {
			set({ flight: { ...flight, arrived: true } })
		}
	},
	dismiss: () => {
		if (get().flight !== null) set({ flight: null })
	},
}))

const easeInOutCubic = (t: number): number =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

/**
 * Share of the distance the camera has crossed at normalized time `t` of a
 * flight whose travel window is [`start`, `end`]: the same easing the flight
 * profile moves its pivot with, so a counter reads what the picture shows.
 */
export function travelledAt(t: number, start: number, end: number): number {
	if (!(end > start)) return t >= end ? 1 : 0
	const u = (t - start) / (end - start)
	return u <= 0 ? 0 : u >= 1 ? 1 : easeInOutCubic(u)
}

/** The share crossed at `now` (ms, `performance.now()` clock) of `flight`. */
export function flightProgress(flight: Flight, now: number): number {
	if (flight.arrived || !(flight.durationMs > 0)) return 1
	const t = (now - flight.startedAt) / flight.durationMs
	return travelledAt(t, flight.travelStart, flight.travelEnd)
}

/**
 * A scripted stop that flies to body `id` (tours #28, the opening #30):
 * `playSequence([flightStep("earth"), flightStep("neptune", { holdMs: 4000 })])`.
 * The flight shows its readout like one the user started.
 */
export const flightStep = (
	id: string,
	options: Omit<SequenceStep, "view" | "profile"> = {},
): SequenceStep => ({
	...options,
	view: { kind: "body", id },
	profile: FLIGHT_PROFILE,
})
