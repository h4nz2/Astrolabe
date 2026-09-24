/**
 * Spin speed (issue #13): how fast the bodies turn on their axes, relative to the
 * simulation clock (docs/ARCHITECTURE.md, "Rotation").
 *
 * Earth turns 365 times per orbit, so at any time warp where an orbit is watchable the
 * true spin is a strobing blur. A spin mode caps how fast the spin may run on screen,
 * expressed as the shortest real time one Earth day may take. The cap slows every body
 * by the same factor, so Jupiter still turns 2.4 times as fast as Earth and Venus still
 * turns backwards; below the cap nothing changes, so a slowed mode is the true speed
 * whenever the true speed is watchable.
 *
 * All spin reads one "spin time" (`SpinClock.spinJD`), a Julian Date that follows the
 * simulation clock: it stops when the clock is paused and runs backwards when it does.
 * In `realistic` mode it IS the simulation time, so every body shows its true
 * orientation for the date (the terminator over the right continent). In the other modes
 * it lags behind: the spin rate is capped, the orientation is no longer the date's.
 * Choosing `realistic` again snaps back to the true orientation at once.
 *
 * Synchronous (tidally locked) moons ignore the mode: they keep their face toward their
 * planet in every mode, because their turning follows from their orbit, not from a spin.
 */

/** Named spin modes, in menu order. A teacher never types a number. */
export const SPIN_MODES = ["realistic", "slowed", "slow", "stopped"] as const
export type SpinMode = (typeof SPIN_MODES)[number]

export const DEFAULT_SPIN_MODE: SpinMode = "realistic"

export const isSpinMode = (value: unknown): value is SpinMode =>
	typeof value === "string" && (SPIN_MODES as readonly string[]).includes(value)

/**
 * The shortest real time, in seconds, one turn of the Earth may take on screen in each
 * mode: 0 = no cap (true speed), Infinity = no spin.
 */
export const MIN_SECONDS_PER_EARTH_TURN: Readonly<Record<SpinMode, number>> = {
	realistic: 0,
	slowed: 4,
	slow: 30,
	stopped: Number.POSITIVE_INFINITY,
}

/** Earth's sidereal day in days (IAU: 23.93447 h). */
export const EARTH_SIDEREAL_DAY_DAYS = 360 / 360.9856235

/** A longer real-time gap between two frames (hidden tab, sleep) counts as this long. */
export const MAX_SPIN_STEP_MS = 250

/** The spin time and what it was advanced from; mutated in place every frame. */
export interface SpinClock {
	/** Julian Date every non-synchronous body's spin angle is evaluated at. */
	spinJD: number
	/** Simulation time of the last update. */
	simJD: number
	/** Real time (ms, performance.now()) of the last update. */
	realMs: number
}

export const createSpinClock = (jd: number, realMs: number): SpinClock => ({
	spinJD: jd,
	simJD: jd,
	realMs,
})

/**
 * Largest spin-time step (days) allowed in `realMs` of real time under `mode`; Infinity
 * for `realistic`, 0 for `stopped`.
 */
export function maxSpinStepDays(mode: SpinMode, realMs: number): number {
	const seconds = MIN_SECONDS_PER_EARTH_TURN[mode]
	if (seconds === 0) return Number.POSITIVE_INFINITY
	return (EARTH_SIDEREAL_DAY_DAYS * (realMs / 1000)) / seconds
}

/**
 * Advances `clock` to simulation time `simJD` at real time `realMs` and returns the new
 * spin time. `realistic` sets it to `simJD` exactly (nothing accumulates, so it never
 * drifts). The other modes move it by the simulation step, clamped to the mode's cap for
 * the real time that passed: frame-rate independent, and a jump of the clock (a new date,
 * "Now") turns the bodies by at most one frame's worth instead of a strobing blur.
 */
export function advanceSpinClock(
	clock: SpinClock,
	simJD: number,
	realMs: number,
	mode: SpinMode,
): number {
	const simStep = simJD - clock.simJD
	const realStep = Math.min(
		Math.max(realMs - clock.realMs, 0),
		MAX_SPIN_STEP_MS,
	)
	clock.simJD = simJD
	clock.realMs = realMs
	if (mode === "realistic") {
		clock.spinJD = simJD
		return simJD
	}
	const limit = maxSpinStepDays(mode, realStep)
	clock.spinJD += Math.min(Math.max(simStep, -limit), limit)
	return clock.spinJD
}
