/**
 * The way into the comparison from the solar system (#24): the card's
 * "Compare with…" opens `/compare` with the focused body and its first
 * partner (`defaultPartner`), measured at the moment on screen. Pure.
 */
import { dateToJD } from "@/sim"

import type { CompareSearch } from "./search"
import { completeBodies, formatBodies } from "./selection"

/** A clock this close to the wall clock, running at 1x, shows the present. */
export const LIVE_TOLERANCE_DAYS = 2 / 1440

export interface ClockState {
	simTimeJD: number
	timeWarp: number
	paused: boolean
}

/** Whether the simulation shows the present: running at real speed, on the wall clock. */
export const isLive = (clock: ClockState, now: Date): boolean =>
	!clock.paused &&
	clock.timeWarp === 1 &&
	Math.abs(clock.simTimeJD - dateToJD(now)) < LIVE_TOLERANCE_DAYS

/**
 * The search of the comparison for `bodyId`. The simulation's moment goes
 * along (`t`, 4 decimals as in the solar system's links) unless it is the
 * present, so distances are the ones of the date on screen.
 */
export function compareSearchFor(
	bodyId: string,
	clock: ClockState,
	now: Date = new Date(),
): CompareSearch {
	return {
		bodies: formatBodies(completeBodies([bodyId])),
		t: isLive(clock, now) ? undefined : Math.round(clock.simTimeJD * 1e4) / 1e4,
	}
}
