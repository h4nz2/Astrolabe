/**
 * Which moments make a sound (#32), read from the stores the features already
 * keep: no feature calls audio code, and nothing here knows Web Audio. The
 * cue sink decides whether anything is heard (sound on, cues on).
 *
 * - a flight (#18) departs: the whoosh; skipped or replaced: it stops
 * - the camera arrives at a body (a flight, a click, a tour stop): its note
 * - pause / play (#14): a tiny tick; a time-travel glide (#14, #26): a sweep
 * - a scavenger-hunt clue solved, the hunt finished (#34)
 * - light from a flash reaching a body (#27): that body's note
 *
 * Deliberately silent: hovering (dozens of bodies under a moving mouse), a
 * wrong guess in the hunt (no buzzer in front of the class), every selection
 * that does not move the camera.
 */
import { useFlightStore, type Flight } from "@/store/flight"
import { useHuntStore } from "@/store/hunt"
import { useLightStore } from "@/store/light"
import { useSimStore } from "@/store/sim"

import { resolveHunt } from "../hunt/hunts"
import { pulseArrivals, type Arrival } from "../light/lightTravel"

export interface SoundCues {
	flightStart: (flight: Flight) => void
	/** The running whoosh should stop (skip, retarget, interruption, arrival). */
	flightEnd: () => void
	arrived: (bodyId: string) => void
	paused: (paused: boolean) => void
	timeTravel: (forward: boolean, durationMs: number) => void
	found: () => void
	finished: () => void
	lightReached: (bodyId: string) => void
}

export interface SoundStores {
	sim: typeof useSimStore
	flight: typeof useFlightStore
	hunt: typeof useHuntStore
	light: typeof useLightStore
}

const DEFAULT_STORES: SoundStores = {
	sim: useSimStore,
	flight: useFlightStore,
	hunt: useHuntStore,
	light: useLightStore,
}

/** At most this many light arrivals ring in one frame (a fast clock passes several at once). */
export const MAX_ARRIVALS_PER_FRAME = 2

const huntLength = (key: string | null): number =>
	resolveHunt(key)?.questions.length ?? 0

/** Subscribes `cues` to the stores; returns the unsubscribe. */
export function watchSoundEvents(
	cues: SoundCues,
	stores: SoundStores = DEFAULT_STORES,
): () => void {
	const offFlight = stores.flight.subscribe((state, prev) => {
		const now = state.flight
		const before = prev.flight
		if (before !== null && !before.arrived) {
			if (now === null || now.id !== before.id || now.arrived) cues.flightEnd()
		}
		if (now !== null && !now.arrived && now.id !== before?.id) {
			cues.flightStart(now)
		}
	})

	// light arrivals: a pointer into the pulse's arrivals, sorted by time
	let arrivals: Arrival[] = []
	let reached = 0
	const resetArrivals = () => {
		const pulse = stores.light.getState().pulse
		arrivals = pulse === null ? [] : pulseArrivals(pulse)
		const jd = stores.sim.getState().simTimeJD
		reached = arrivals.filter((arrival) => arrival.jd <= jd).length
	}
	resetArrivals()
	const offLight = stores.light.subscribe((state, prev) => {
		if (state.pulse !== prev.pulse) resetArrivals()
	})

	const offSim = stores.sim.subscribe((state, prev) => {
		if (prev.transition !== null && state.transition === null) {
			if (state.view.kind === "body") cues.arrived(state.view.id)
		}
		if (state.paused !== prev.paused) cues.paused(state.paused)
		const glide = state.clock.glide
		if (glide !== null && prev.clock.glide === null) {
			cues.timeTravel(state.clock.anchorJD >= glide.fromJD, glide.durationMs)
		}
		if (arrivals.length > 0 && state.simTimeJD !== prev.simTimeJD) {
			const jd = state.simTimeJD
			let rung = 0
			while (reached < arrivals.length && arrivals[reached].jd <= jd) {
				if (rung < MAX_ARRIVALS_PER_FRAME)
					cues.lightReached(arrivals[reached].id)
				rung++
				reached++
			}
			// time running back un-reaches bodies, silently
			while (reached > 0 && arrivals[reached - 1].jd > jd) reached--
		}
	})

	const offHunt = stores.hunt.subscribe((state, prev) => {
		if (state.key === null || state.key !== prev.key) return
		if (prev.phase === "asking" && state.phase === "found") cues.found()
		const total = huntLength(state.key)
		if (total > 0 && prev.step < total && state.step >= total) cues.finished()
	})

	return () => {
		offFlight()
		offLight()
		offSim()
		offHunt()
	}
}
