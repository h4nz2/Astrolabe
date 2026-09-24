import { describe, expect, it } from "vitest"

import {
	EARTH_SIDEREAL_DAY_DAYS,
	MAX_SPIN_STEP_MS,
	SPIN_MODES,
	advanceSpinClock,
	createSpinClock,
	isSpinMode,
	maxSpinStepDays,
	type SpinMode,
} from "./spin"
import { J2000_JD } from "./time"

/** Runs a clock at `warp` days of simulation per real second for `seconds`, in `fps` frames. */
const run = (
	mode: SpinMode,
	warpDaysPerSecond: number,
	seconds: number,
	fps = 60,
) => {
	const clock = createSpinClock(J2000_JD, 0)
	const frames = Math.round(seconds * fps)
	for (let f = 1; f <= frames; f++) {
		const t = f / fps
		advanceSpinClock(clock, J2000_JD + warpDaysPerSecond * t, t * 1000, mode)
	}
	return clock
}

describe("spin modes", () => {
	it("are named, realistic first", () => {
		expect(SPIN_MODES[0]).toBe("realistic")
		expect(isSpinMode("slowed")).toBe(true)
		expect(isSpinMode("fast")).toBe(false)
		expect(isSpinMode(2)).toBe(false)
	})

	it("cap one Earth turn to 4 s (slowed) and 30 s (slow); stopped never turns", () => {
		expect(maxSpinStepDays("realistic", 1000)).toBe(Number.POSITIVE_INFINITY)
		expect(maxSpinStepDays("slowed", 4000)).toBeCloseTo(
			EARTH_SIDEREAL_DAY_DAYS,
			12,
		)
		expect(maxSpinStepDays("slow", 30_000)).toBeCloseTo(
			EARTH_SIDEREAL_DAY_DAYS,
			12,
		)
		expect(maxSpinStepDays("stopped", 1000)).toBe(0)
	})
})

describe("advanceSpinClock", () => {
	it("is the simulation time itself in the realistic mode, at any warp", () => {
		const clock = run("realistic", 30, 2)
		expect(clock.spinJD).toBe(J2000_JD + 60)
		expect(clock.spinJD).toBe(clock.simJD)
	})

	it("leaves a watchable spin untouched in the slowed modes", () => {
		// 1 hour per second: one Earth day takes 24 s, slower than both caps
		const slowed = run("slowed", 1 / 24, 3)
		expect(slowed.spinJD).toBeCloseTo(J2000_JD + 3 / 24, 9)
		const slow = run("slow", 1 / 60, 3)
		expect(slow.spinJD).toBeCloseTo(J2000_JD + 3 / 60, 9)
	})

	it("caps a blurring spin at one Earth turn per 4 s (slowed) or 30 s (slow)", () => {
		// one month per second: 30 turns a second at true speed
		const slowed = run("slowed", 30, 8)
		// JD doubles near 2.45e6 resolve ~4e-10 d, summed over 480 frames
		expect(slowed.spinJD - J2000_JD).toBeCloseTo(2 * EARTH_SIDEREAL_DAY_DAYS, 5)
		const slow = run("slow", 30, 60)
		expect(slow.spinJD - J2000_JD).toBeCloseTo(2 * EARTH_SIDEREAL_DAY_DAYS, 5)
		// the simulation itself is untouched
		expect(slowed.simJD).toBeCloseTo(J2000_JD + 240, 9)
	})

	it("is frame-rate independent", () => {
		const at60 = run("slowed", 30, 4, 60)
		const at13 = run("slowed", 30, 4, 13)
		expect(at13.spinJD).toBeCloseTo(at60.spinJD, 6)
	})

	it("follows the clock backwards, and holds still while it is paused", () => {
		const clock = createSpinClock(J2000_JD, 0)
		advanceSpinClock(clock, J2000_JD - 0.01, 1000, "slowed")
		expect(clock.spinJD).toBeCloseTo(J2000_JD - 0.01, 12)
		advanceSpinClock(clock, J2000_JD - 0.01, 2000, "slowed")
		expect(clock.spinJD).toBeCloseTo(J2000_JD - 0.01, 12)
	})

	it("never turns in the stopped mode", () => {
		expect(run("stopped", 30, 2).spinJD).toBe(J2000_JD)
	})

	it("turns a jump of the clock into at most one capped frame", () => {
		const clock = createSpinClock(J2000_JD, 0)
		advanceSpinClock(clock, J2000_JD + 3650, 16, "slowed")
		expect(clock.spinJD - J2000_JD).toBeCloseTo(
			maxSpinStepDays("slowed", 16),
			8,
		)
		// a long real gap (hidden tab) counts as MAX_SPIN_STEP_MS
		advanceSpinClock(clock, J2000_JD + 7300, 60_000, "slowed")
		expect(clock.spinJD - J2000_JD).toBeCloseTo(
			maxSpinStepDays("slowed", 16 + MAX_SPIN_STEP_MS),
			8,
		)
	})

	it("snaps back to the true orientation when realistic is chosen again", () => {
		const clock = run("stopped", 1, 2)
		expect(clock.spinJD).toBe(J2000_JD)
		advanceSpinClock(clock, J2000_JD + 2.5, 2500, "realistic")
		expect(clock.spinJD).toBe(J2000_JD + 2.5)
	})
})
