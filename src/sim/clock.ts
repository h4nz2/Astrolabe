/**
 * The simulation clock (issue #9): simulation time as a pure function of real
 * time.
 *
 * A `SimTimeline` is a small immutable value. Sampling it at a real instant
 * (`timelineJD`) gives the simulation time as a Julian Date:
 *
 *   jd(realMs) = anchorJD + (realMs - anchorMs) * rate / MS_PER_DAY
 *
 * optionally preceded by an eased glide that ends at the anchor. Nothing is
 * accumulated frame by frame, so:
 *
 * - the result depends on the real instant alone, never on how many frames
 *   were drawn in between (a 144 Hz and a 30 Hz machine agree exactly);
 * - there is no rounding drift, however long the session runs: every sample
 *   is one multiplication away from an exact anchor;
 * - pause (rate 0), reverse (negative rate) and a changed speed re-anchor at
 *   the current value, so nothing ever moves when the rate changes;
 * - a jump to another date can glide there (`glideTimeline`), so bodies sweep
 *   to their new places instead of teleporting.
 *
 * Real time is whatever monotonic millisecond clock the caller uses (the app
 * passes `performance.now()`); like the rest of src/sim this module never reads
 * a clock itself. Rates are simulated seconds per real second (the store's
 * `timeWarp`): 1 is real time, 86400 a day per second.
 */
import { MS_PER_DAY } from "./time"

/** An eased approach to the anchor: from `fromJD` at `anchorMs - durationMs` to `anchorJD` at `anchorMs`. */
export interface TimeGlide {
	readonly fromJD: number
	readonly durationMs: number
}

export interface SimTimeline {
	/** Simulation time (Julian Date) at real time `anchorMs`. */
	readonly anchorJD: number
	/** Real time (ms, the caller's monotonic clock) at which the simulation is at `anchorJD`. */
	readonly anchorMs: number
	/** Simulated seconds per real second from `anchorMs` on: 0 stands still, negative runs backwards. */
	readonly rate: number
	/** A glide in progress (or finished but not yet settled) that ends at the anchor; null otherwise. */
	readonly glide: TimeGlide | null
}

/**
 * Longest real-time gap between two frames that still counts in full. A longer
 * gap means the page was not being drawn (hidden tab, sleeping laptop, a long
 * stall): only this much of it advances the simulation, so the scene resumes
 * where it was instead of leaping ahead. 250 ms keeps machines down to 4 fps
 * exactly on time. Real-time speed (rate 1) is exempt, see `skipFrameGap`.
 */
export const MAX_FRAME_GAP_MS = 250

/** Jumps shorter than this (one minute of simulated time) happen at once: nothing visible moves that little. */
export const INSTANT_JUMP_DAYS = 1 / 1440

/** Shortest and longest glide for a jump, in real milliseconds. */
export const GLIDE_MIN_MS = 600
export const GLIDE_MAX_MS = 2500
/** Extra glide time per decade of jumped days. */
const GLIDE_MS_PER_DECADE = 400

/** A timeline sitting at `jd` at real time `realMs`, running at `rate` (0 = standing still). */
export function createTimeline(
	jd: number,
	realMs: number,
	rate = 0,
): SimTimeline {
	return { anchorJD: jd, anchorMs: realMs, rate, glide: null }
}

/**
 * Smooth start and stop: 0 -> 0, 1 -> 1, slope 0 at both ends, peak speed
 * pi/2 times the mean (gentler than a cubic ease, which peaks at 3x).
 */
export function easeInOutSine(p: number): number {
	if (p <= 0) return 0
	if (p >= 1) return 1
	return (1 - Math.cos(Math.PI * p)) / 2
}

/** Simulation time (Julian Date) of `timeline` at real time `realMs`. */
export function timelineJD(timeline: SimTimeline, realMs: number): number {
	const { anchorJD, anchorMs, rate, glide } = timeline
	if (glide !== null && realMs < anchorMs) {
		const startMs = anchorMs - glide.durationMs
		if (realMs <= startMs) return glide.fromJD
		const remaining = 1 - easeInOutSine((realMs - startMs) / glide.durationMs)
		// measured back from the anchor, so the glide lands on it exactly
		return anchorJD - (anchorJD - glide.fromJD) * remaining
	}
	// rate 0 adds exactly 0: a standing clock returns its anchor bit for bit
	return anchorJD + ((realMs - anchorMs) * rate) / MS_PER_DAY
}

/** True while a glide is still under way at `realMs`. */
export const isGliding = (timeline: SimTimeline, realMs: number): boolean =>
	timeline.glide !== null && realMs < timeline.anchorMs

/**
 * The same timeline running at `rate` from `realMs` on, continuous at `realMs`:
 * pausing, reversing or changing speed never moves anything. During a glide the
 * glide finishes first and the new rate applies from its end.
 */
export function retimeTimeline(
	timeline: SimTimeline,
	realMs: number,
	rate: number,
): SimTimeline {
	if (rate === timeline.rate) return timeline
	if (isGliding(timeline, realMs)) return { ...timeline, rate }
	return createTimeline(timelineJD(timeline, realMs), realMs, rate)
}

/** An instant jump to `jd` at `realMs`, keeping the rate; cancels any glide. */
export function jumpTimeline(
	timeline: SimTimeline,
	realMs: number,
	jd: number,
): SimTimeline {
	return createTimeline(jd, realMs, timeline.rate)
}

/**
 * Real milliseconds a jump of `deltaDays` glides for: 0 below a minute of
 * simulated time, otherwise from GLIDE_MIN_MS growing with the logarithm of the
 * distance up to GLIDE_MAX_MS (a day 0.7 s, a year 1.6 s, a decade 2 s, 150 years
 * and more 2.5 s).
 */
export function glideDurationMs(deltaDays: number): number {
	const days = Math.abs(deltaDays)
	if (!(days >= INSTANT_JUMP_DAYS)) return 0
	const ms = GLIDE_MIN_MS + GLIDE_MS_PER_DECADE * Math.log10(1 + days)
	return Math.min(GLIDE_MAX_MS, ms)
}

/**
 * A jump to `jd` that glides there from wherever the clock is at `realMs`
 * (mid-glide included), arriving `durationMs` later and then running on at the
 * timeline's rate. Every body sweeps along its real path; nothing teleports.
 * A duration of 0 (the default for jumps under a minute) jumps at once.
 */
export function glideTimeline(
	timeline: SimTimeline,
	realMs: number,
	jd: number,
	durationMs?: number,
): SimTimeline {
	const fromJD = timelineJD(timeline, realMs)
	const ms = durationMs ?? glideDurationMs(jd - fromJD)
	if (!(ms > 0)) return jumpTimeline(timeline, realMs, jd)
	return {
		anchorJD: jd,
		anchorMs: realMs + ms,
		rate: timeline.rate,
		glide: { fromJD, durationMs: ms },
	}
}

/** Drops a glide that has ended by `realMs` (the samples do not change); otherwise returns `timeline`. */
export function settleTimeline(
	timeline: SimTimeline,
	realMs: number,
): SimTimeline {
	return timeline.glide !== null && realMs >= timeline.anchorMs
		? { ...timeline, glide: null }
		: timeline
}

/**
 * Accounts for the real time between two frames, `lastMs` and `nowMs`. A gap
 * up to MAX_FRAME_GAP_MS counts in full (frame-rate independence); of a longer
 * one only MAX_FRAME_GAP_MS counts, by sliding the timeline later in real time,
 * so a tab left in the background resumes where it was instead of years later.
 * At real-time speed (rate 1) the whole gap counts: a clock showing the present
 * keeps showing the present. Time before the timeline's current segment began
 * (an action taken during the gap) is never skipped.
 */
export function skipFrameGap(
	timeline: SimTimeline,
	lastMs: number,
	nowMs: number,
): SimTimeline {
	if (timeline.rate === 1) return timeline
	const excess = nowMs - lastMs - MAX_FRAME_GAP_MS
	if (!(excess > 0)) return timeline
	const segmentStartMs =
		timeline.glide === null
			? timeline.anchorMs
			: timeline.anchorMs - timeline.glide.durationMs
	const skip = Math.min(excess, nowMs - segmentStartMs)
	if (!(skip > 0)) return timeline
	return { ...timeline, anchorMs: timeline.anchorMs + skip }
}
