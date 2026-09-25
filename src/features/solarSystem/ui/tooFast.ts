/**
 * The wagon-wheel warning (issue #14). At high speed a body can move so far
 * between two frames that the eye links the wrong positions: past half an
 * orbit per frame it seems to run backwards, well before that it only jumps.
 * Positions stay correct; perception does not. The HUD therefore names the
 * fastest body in view when it laps faster than the screen can show, and
 * says so in plain words, instead of hiding it or capping the speed further.
 */
import type { Body } from "@/data"
import { SECONDS_PER_DAY } from "@/sim"

/**
 * Laps per drawn frame from which motion is no longer followable: a sixth of
 * an orbit (60°). Mercury reaches it at 10 years/s even at 60 fps; at 1 year/s
 * only on a device drawing fewer than 25 frames a second.
 */
export const TOO_FAST_LAPS_PER_FRAME = 1 / 6

/** Frame rate assumed until one is measured. */
export const DEFAULT_FPS = 60

export interface TooFast {
	/** The fastest body in view. */
	id: string
	parentId: string
	/** Its laps around its parent per real second at the current speed. */
	lapsPerSecond: number
}

/** Laps per real second of an orbit of `periodDays` at `warp` (either direction). */
export const lapsPerSecond = (periodDays: number, warp: number): number =>
	Math.abs(warp) / (Math.abs(periodDays) * SECONDS_PER_DAY)

/**
 * The bodies whose motion the viewer can see: the planets, plus the moons of
 * the focused planet's family (the focused planet or the focused moon's
 * planet) while moons are shown, and the focus itself. Distant moon systems are
 * dots in the overview, so their laps do not count.
 */
export function bodiesInView(
	bodies: readonly Body[],
	focusId: string,
	showMoons: boolean,
): Body[] {
	const focus = bodies.find((body) => body.id === focusId)
	const family = focus?.kind === "moon" ? focus.parentId : focusId
	return bodies.filter(
		(body) =>
			body.orbit !== null &&
			body.parentId !== null &&
			(body.kind === "planet" ||
				body.id === focusId ||
				(showMoons && body.kind === "moon" && body.parentId === family)),
	)
}

/**
 * The fastest body in view when it laps more than `TOO_FAST_LAPS_PER_FRAME`
 * at `fps`; null when everything can be followed, and always while paused
 * (warp 0) or before any frame rate is known (`fps` <= 0 falls back to 60).
 */
export function tooFastToFollow(
	inView: readonly Body[],
	warp: number,
	fps: number,
): TooFast | null {
	if (warp === 0 || !Number.isFinite(warp)) return null
	const rate = fps > 0 && Number.isFinite(fps) ? fps : DEFAULT_FPS
	let fastest: TooFast | null = null
	for (const body of inView) {
		if (body.orbit === null || body.parentId === null) continue
		const laps = lapsPerSecond(body.orbit.periodDays, warp)
		if (laps / rate < TOO_FAST_LAPS_PER_FRAME) continue
		if (fastest === null || laps > fastest.lapsPerSecond) {
			fastest = { id: body.id, parentId: body.parentId, lapsPerSecond: laps }
		}
	}
	return fastest
}
