import { describe, expect, it } from "vitest"

import { bodies } from "@/data"

import {
	GLIDE_MAX_MS,
	GLIDE_MIN_MS,
	MAX_FRAME_GAP_MS,
	createTimeline,
	easeInOutSine,
	glideDurationMs,
	glideTimeline,
	isGliding,
	jumpTimeline,
	retimeTimeline,
	settleTimeline,
	skipFrameGap,
	timelineJD,
	type SimTimeline,
} from "./clock"
import { buildIndex, computePositions } from "./positions"
import { J2000_JD, MS_PER_DAY } from "./time"

const DAY = 86400 // simulated seconds per real second: one day per second
const YEAR = 31557600 // one Julian year per second
const T0 = 1_000 // an arbitrary performance.now() origin, ms

/**
 * Ticks `timeline` like the frame loop does, from `fromMs` to `toMs` at
 * `hz` frames per second (the last frame exactly at `toMs`), and returns the
 * timeline after the last frame with every frame's sample.
 */
function runFrames(
	timeline: SimTimeline,
	fromMs: number,
	toMs: number,
	hz: number,
): { timeline: SimTimeline; samples: Float64Array } {
	const frames = Math.round(((toMs - fromMs) * hz) / 1000)
	const samples = new Float64Array(frames)
	let t = timeline
	let last = fromMs
	for (let k = 1; k <= frames; k++) {
		const ms = fromMs + ((toMs - fromMs) * k) / frames
		t = settleTimeline(skipFrameGap(t, last, ms), ms)
		samples[k - 1] = timelineJD(t, ms)
		last = ms
	}
	return { timeline: t, samples }
}

describe("timeline sampling", () => {
	it("runs at the rate, in simulated seconds per real second", () => {
		const t = createTimeline(J2000_JD, T0, DAY)
		expect(timelineJD(t, T0)).toBe(J2000_JD)
		expect(timelineJD(t, T0 + 1000)).toBe(J2000_JD + 1)
		expect(timelineJD(t, T0 + 2500)).toBe(J2000_JD + 2.5)
		expect(timelineJD(createTimeline(J2000_JD, T0, 1), T0 + MS_PER_DAY)).toBe(
			J2000_JD + 1,
		)
		expect(timelineJD(createTimeline(J2000_JD, T0, YEAR), T0 + 1000)).toBe(
			J2000_JD + 365.25,
		)
	})

	it("stands still at rate 0 (pause) and runs backwards at a negative rate (reverse)", () => {
		const paused = createTimeline(J2000_JD, T0, 0)
		for (const ms of [T0, T0 + 1, T0 + 3.6e6, T0 + 8.64e7]) {
			expect(timelineJD(paused, ms)).toBe(J2000_JD)
		}
		const reverse = createTimeline(J2000_JD, T0, -DAY)
		expect(timelineJD(reverse, T0 + 3000)).toBe(J2000_JD - 3)
		// a standing timeline also answers for instants before its anchor
		expect(createTimeline(J2000_JD, T0).rate).toBe(0)
	})

	it("is independent of the frame rate: 144 Hz and 30 Hz agree bit for bit", () => {
		for (const rate of [1, 60, DAY, YEAR, -DAY]) {
			const start = createTimeline(J2000_JD, T0, rate)
			const fast = runFrames(start, T0, T0 + 10_000, 144)
			const slow = runFrames(start, T0, T0 + 10_000, 30)
			const end = T0 + 10_000
			expect(timelineJD(fast.timeline, end)).toBe(
				timelineJD(slow.timeline, end),
			)
			expect(timelineJD(fast.timeline, end)).toBe(timelineJD(start, end))
		}
	})

	it("keeps real time for hours without drift", () => {
		// eight hours of frames at 144 Hz: an accumulating clock (jd += dt per
		// frame) drifts by seconds here, the anchored one stays on the exact value
		const start = createTimeline(J2000_JD, 0, 1)
		const hours = 8
		const end = hours * 3.6e6
		const { samples } = runFrames(start, 0, end, 144)
		const last = samples[samples.length - 1]
		const ulp = 2 ** -21 // spacing of doubles near JD 2.45e6, in days (about 40 microseconds)
		expect(Math.abs(last - (J2000_JD + hours / 24))).toBeLessThanOrEqual(ulp)
		// and it never runs backwards at a positive rate
		let monotonic = true
		for (let i = 1; i < samples.length; i++) {
			if (samples[i] < samples[i - 1]) monotonic = false
		}
		expect(monotonic).toBe(true)

		let accumulated = J2000_JD
		for (let i = 0; i < samples.length; i++) accumulated += 1 / 144 / 86400
		expect(Math.abs(accumulated - last)).toBeGreaterThan(100 * ulp)
	})

	it("holds precision across the whole speed range (Mercury to Neptune)", () => {
		// one real hour at each preset lands on the exact product, to a double's spacing
		for (const rate of [1, 60, 3600, DAY, 604800, 2629800, YEAR]) {
			const t = createTimeline(J2000_JD, T0, rate)
			const days = (3600 * rate) / 86400
			const jd = timelineJD(t, T0 + 3.6e6)
			expect(Math.abs(jd - (J2000_JD + days))).toBeLessThanOrEqual(
				Math.abs(J2000_JD + days) * Number.EPSILON,
			)
		}
	})
})

describe("changing the rate", () => {
	it("never moves anything: the sample at the moment of the change is unchanged", () => {
		let t = createTimeline(J2000_JD, T0, DAY)
		let ms = T0
		for (const rate of [YEAR, 0, -DAY, 1, -YEAR, 60, 0, DAY]) {
			ms += 1234.5
			const before = timelineJD(t, ms)
			t = retimeTimeline(t, ms, rate)
			expect(timelineJD(t, ms)).toBe(before)
			expect(t.rate).toBe(rate)
		}
	})

	it("returns the same timeline when the rate does not change", () => {
		const t = createTimeline(J2000_JD, T0, DAY)
		expect(retimeTimeline(t, T0 + 500, DAY)).toBe(t)
	})

	it("reverses coherently: forward then backward for the same time returns to the start", () => {
		const start = createTimeline(J2000_JD, T0, DAY)
		const turned = retimeTimeline(start, T0 + 10_000, -DAY)
		expect(timelineJD(turned, T0 + 10_000)).toBe(J2000_JD + 10)
		expect(timelineJD(turned, T0 + 20_000)).toBeCloseTo(J2000_JD, 9)
	})

	it("lets a glide finish and applies the new rate from its end", () => {
		const gliding = glideTimeline(
			createTimeline(J2000_JD, T0, 1),
			T0,
			J2000_JD + 100,
			1000,
		)
		const paused = retimeTimeline(gliding, T0 + 400, 0)
		expect(paused.glide).toEqual(gliding.glide)
		expect(timelineJD(paused, T0 + 400)).toBe(timelineJD(gliding, T0 + 400))
		expect(timelineJD(paused, T0 + 1000)).toBe(J2000_JD + 100)
		expect(timelineJD(paused, T0 + 5000)).toBe(J2000_JD + 100)
	})
})

describe("jumping to a date", () => {
	it("jumps at once and keeps the rate", () => {
		const t = jumpTimeline(createTimeline(J2000_JD, T0, DAY), T0 + 100, 2460000)
		expect(timelineJD(t, T0 + 100)).toBe(2460000)
		expect(timelineJD(t, T0 + 1100)).toBe(2460001)
		expect(t.glide).toBeNull()
	})

	it("glides without a discontinuity and lands exactly on the date", () => {
		const target = J2000_JD + 9500 // 26 years later
		const start = createTimeline(J2000_JD, T0, 0)
		const t = glideTimeline(start, T0, target)
		const duration = glideDurationMs(target - J2000_JD)
		expect(t.glide).toEqual({ fromJD: J2000_JD, durationMs: duration })
		expect(timelineJD(t, T0)).toBe(J2000_JD)
		expect(isGliding(t, T0 + duration / 2)).toBe(true)
		expect(timelineJD(t, T0 + duration / 2)).toBeCloseTo(J2000_JD + 9500 / 2, 6)
		expect(timelineJD(t, T0 + duration)).toBe(target)
		expect(isGliding(t, T0 + duration)).toBe(false)

		// sampled at 60 Hz the glide is monotonic and no frame step is larger
		// than the peak speed of the easing allows (pi/2 times the mean speed)
		let previous = timelineJD(t, T0)
		const frame = 1000 / 60
		const maxStep = (9500 / duration) * frame * (Math.PI / 2) * 1.001
		for (let ms = T0 + frame; ms <= T0 + duration + 3 * frame; ms += frame) {
			const jd = timelineJD(t, ms)
			expect(jd).toBeGreaterThanOrEqual(previous)
			expect(jd - previous).toBeLessThanOrEqual(maxStep)
			previous = jd
		}
		expect(previous).toBe(target)
	})

	it("glides backwards just as well", () => {
		const t = glideTimeline(createTimeline(J2000_JD, T0, 0), T0, J2000_JD - 400)
		const duration = t.glide!.durationMs
		expect(timelineJD(t, T0 + duration / 4)).toBeLessThan(J2000_JD)
		expect(timelineJD(t, T0 + duration / 4)).toBeGreaterThan(J2000_JD - 400)
		expect(timelineJD(t, T0 + duration)).toBe(J2000_JD - 400)
	})

	it("resumes the rate after arriving", () => {
		const t = glideTimeline(
			createTimeline(J2000_JD, T0, DAY),
			T0,
			J2000_JD + 50,
			800,
		)
		expect(timelineJD(t, T0 + 800)).toBe(J2000_JD + 50)
		expect(timelineJD(t, T0 + 1800)).toBe(J2000_JD + 51)
	})

	it("re-targets a glide mid-way from where it is, without a jump", () => {
		const first = glideTimeline(
			createTimeline(J2000_JD, T0, 0),
			T0,
			J2000_JD + 1000,
			1000,
		)
		const midway = timelineJD(first, T0 + 300)
		const second = glideTimeline(first, T0 + 300, J2000_JD - 1000, 1000)
		expect(timelineJD(second, T0 + 300)).toBe(midway)
		expect(timelineJD(second, T0 + 1300)).toBe(J2000_JD - 1000)
	})

	it("jumps under a minute happen at once", () => {
		const start = createTimeline(J2000_JD, T0, 1)
		const t = glideTimeline(start, T0, J2000_JD + 30 / 86400)
		expect(t.glide).toBeNull()
		expect(timelineJD(t, T0)).toBe(J2000_JD + 30 / 86400)
		expect(glideTimeline(start, T0, J2000_JD + 5, 0).glide).toBeNull()
	})

	it("scales the glide with the logarithm of the distance, within bounds", () => {
		expect(glideDurationMs(0)).toBe(0)
		expect(glideDurationMs(Number.NaN)).toBe(0)
		expect(glideDurationMs(1)).toBeGreaterThanOrEqual(GLIDE_MIN_MS)
		expect(glideDurationMs(1)).toBeLessThan(800)
		expect(glideDurationMs(-365)).toBe(glideDurationMs(365))
		expect(glideDurationMs(365)).toBeGreaterThan(glideDurationMs(30))
		expect(glideDurationMs(3652)).toBeGreaterThan(glideDurationMs(365))
		expect(glideDurationMs(1e6)).toBe(GLIDE_MAX_MS)
		expect(glideDurationMs(Number.POSITIVE_INFINITY)).toBe(GLIDE_MAX_MS)
	})

	it("settles a finished glide without changing any sample", () => {
		const t = glideTimeline(
			createTimeline(J2000_JD, T0, DAY),
			T0,
			J2000_JD + 9,
			700,
		)
		expect(settleTimeline(t, T0 + 699)).toBe(t)
		const settled = settleTimeline(t, T0 + 700)
		expect(settled.glide).toBeNull()
		for (const ms of [T0 + 700, T0 + 1234, T0 + 99_999]) {
			expect(timelineJD(settled, ms)).toBe(timelineJD(t, ms))
		}
		expect(settleTimeline(settled, T0 + 800)).toBe(settled)
	})

	it("eases in and out", () => {
		expect(easeInOutSine(-1)).toBe(0)
		expect(easeInOutSine(0)).toBe(0)
		expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 15)
		expect(easeInOutSine(1)).toBe(1)
		expect(easeInOutSine(2)).toBe(1)
		expect(easeInOutSine(0.1)).toBeLessThan(0.1)
		expect(easeInOutSine(0.9)).toBeGreaterThan(0.9)
	})
})

describe("frame gaps", () => {
	it("counts gaps up to MAX_FRAME_GAP_MS in full", () => {
		const t = createTimeline(J2000_JD, T0, DAY)
		expect(skipFrameGap(t, T0, T0 + MAX_FRAME_GAP_MS)).toBe(t)
	})

	it("drops the excess of a long gap, so a hidden tab resumes where it was", () => {
		const t = createTimeline(J2000_JD, T0, YEAR)
		const lastFrame = T0 + 1000
		const back = lastFrame + 10 * 60_000 // ten minutes in another tab
		const resumed = skipFrameGap(t, lastFrame, back)
		expect(timelineJD(resumed, back)).toBeCloseTo(
			timelineJD(t, lastFrame + MAX_FRAME_GAP_MS),
			9,
		)
	})

	it("keeps real time across any gap at 1x, so the present stays the present", () => {
		const t = createTimeline(J2000_JD, T0, 1)
		expect(skipFrameGap(t, T0, T0 + 3.6e6)).toBe(t)
	})

	it("never skips time from before the current segment began", () => {
		// the clock was re-anchored (a jump) in the middle of a long gap
		const jumped = createTimeline(2460000, T0 + 5000, DAY)
		const resumed = skipFrameGap(jumped, T0, T0 + 5000)
		expect(timelineJD(resumed, T0 + 5000)).toBe(2460000)
		const later = skipFrameGap(jumped, T0, T0 + 6000)
		expect(timelineJD(later, T0 + 6000)).toBeGreaterThanOrEqual(2460000)
	})

	it("pauses a glide while the page is not drawn", () => {
		const t = glideTimeline(
			createTimeline(J2000_JD, T0, 0),
			T0,
			J2000_JD + 1000,
			1000,
		)
		const atHide = timelineJD(t, T0 + 400)
		const resumed = skipFrameGap(t, T0 + 400, T0 + 60_000)
		expect(timelineJD(resumed, T0 + 60_000)).toBeCloseTo(
			timelineJD(t, T0 + 400 + MAX_FRAME_GAP_MS),
			9,
		)
		expect(timelineJD(resumed, T0 + 60_000)).toBeGreaterThan(atHide)
		expect(isGliding(resumed, T0 + 60_000)).toBe(true)
	})
})

describe("positions are a pure function of the clock", () => {
	const index = buildIndex(bodies)

	it("setting the clock to the same date twice gives bit-identical positions", () => {
		const date = 2461307.25 // 2026-09-24 18:00 UTC
		let t = createTimeline(J2000_JD, T0, YEAR)
		t = jumpTimeline(t, T0 + 1000, date)
		t = retimeTimeline(t, T0 + 1000, 0)
		const first = computePositions(
			bodies,
			timelineJD(t, T0 + 5000),
			undefined,
			index,
		)

		// wander off: run, reverse, glide somewhere else, then come back
		t = retimeTimeline(t, T0 + 6000, -DAY)
		t = glideTimeline(t, T0 + 9000, J2000_JD - 3000)
		t = settleTimeline(t, T0 + 20_000)
		t = jumpTimeline(retimeTimeline(t, T0 + 21_000, 0), T0 + 21_000, date)
		const second = computePositions(
			bodies,
			timelineJD(t, T0 + 99_000),
			undefined,
			index,
		)

		expect(second.length).toBe(first.length)
		for (let i = 0; i < first.length; i++) {
			expect(Object.is(second[i], first[i])).toBe(true)
		}
	})

	it("pausing freezes every body at once", () => {
		const t = retimeTimeline(createTimeline(J2000_JD, T0, YEAR), T0 + 700, 0)
		const a = computePositions(
			bodies,
			timelineJD(t, T0 + 700),
			undefined,
			index,
		)
		const b = computePositions(
			bodies,
			timelineJD(t, T0 + 60_700),
			undefined,
			index,
		)
		expect(Array.from(b)).toEqual(Array.from(a))
	})
})
