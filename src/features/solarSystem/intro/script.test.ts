import { describe, expect, it } from "vitest"

import { bodyById } from "@/data"
import { propagate, radToDeg } from "@/sim"
import { HOME_SHOT, OVERVIEW, isValidView } from "@/store/navigation"

import {
	EARTH_PHASE_DEG,
	INTRO_BEATS,
	INTRO_MAX_MS,
	SCALE_BEAT,
	SCALE_REVEAL_MS,
	beatStartsMs,
	hasExplicitView,
	introSteps,
	sequenceLengthMs,
	sunlitAzimuthDeg,
	turnToward,
} from "./script"

const J2000 = 2451545
const angleBetween = (a: number, b: number) =>
	Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180)

describe("the opening's script", () => {
	for (const reducedMotion of [false, true]) {
		describe(reducedMotion ? "reduced motion" : "with motion", () => {
			const steps = introSteps({ earthAzimuthDeg: 120, reducedMotion })

			it("is one step per beat, every view valid, every step timed", () => {
				expect(steps).toHaveLength(INTRO_BEATS.length)
				for (const step of steps) {
					expect(isValidView(step.view)).toBe(true)
					expect(step.durationMs).toBeGreaterThanOrEqual(0)
					expect(step.holdMs).toBeGreaterThan(0)
				}
			})

			it("lasts under fifteen seconds", () => {
				expect(sequenceLengthMs(steps)).toBeLessThan(INTRO_MAX_MS)
				expect(sequenceLengthMs(steps)).toBeGreaterThan(10_000)
			})

			it("opens close on Earth with a cut and ends on the overview a reset shows", () => {
				expect(steps[0].view).toEqual({ kind: "body", id: "earth" })
				expect(steps[0].durationMs).toBe(0)
				expect(steps[0].shot?.azimuthDeg).toBeCloseTo(120)
				const last = steps[steps.length - 1]
				expect(last.view).toEqual(OVERVIEW)
				expect(last.shot).toEqual(HOME_SHOT)
			})

			it("pulls back beat by beat: the Moon's orbit, then the inner planets, then everything", () => {
				expect(steps[1].view).toEqual({ kind: "body", id: "earth" })
				expect(steps[1].fit?.around).toBe("earth")
				expect(steps[1].fit?.km).toBeGreaterThan(384_400)
				expect(steps[2].view).toEqual(OVERVIEW)
				expect(steps[2].fit?.around).toBe("sun")
				// Mars's orbit (1.52 AU) fits, Jupiter's (5.2 AU) does not
				const au = 149_597_870.7
				expect(steps[2].fit?.km).toBeGreaterThan(1.6 * au)
				expect(steps[2].fit?.km).toBeLessThan(5 * au)
			})

			it("holds the last beat long enough for the scale switch to land", () => {
				expect(SCALE_BEAT).toBe(steps.length - 1)
				if (!reducedMotion) {
					expect(steps[SCALE_BEAT].holdMs).toBeGreaterThan(SCALE_REVEAL_MS)
				}
			})

			it(
				reducedMotion ? "cuts between the shots" : "moves between the shots",
				() => {
					const moves = steps.slice(1, SCALE_BEAT).map((s) => s.durationMs)
					for (const ms of moves) {
						if (reducedMotion) expect(ms).toBe(0)
						else expect(ms).toBeGreaterThan(1000)
					}
				},
			)
		})
	}

	it("turns the camera from Earth's sunlit side to the home direction over the pull-back", () => {
		const steps = introSteps({ earthAzimuthDeg: 150, reducedMotion: false })
		const az = steps.map((step) => step.shot?.azimuthDeg ?? NaN)
		// the shorter way round: 150 degrees of turn in all, never 210
		const gaps = az.slice(1).map((a, i) => angleBetween(a, az[i]))
		expect(gaps.reduce((sum, gap) => sum + gap, 0)).toBeCloseTo(150, 5)
		expect(az[3]).toBe(0)
	})

	it("gives each beat's start for the progress bar", () => {
		const steps = introSteps({ earthAzimuthDeg: 0, reducedMotion: false })
		const starts = beatStartsMs(steps)
		expect(starts[0]).toBe(0)
		expect(starts[1]).toBe(steps[0].holdMs)
		for (let i = 1; i < starts.length; i++) {
			expect(starts[i]).toBeGreaterThan(starts[i - 1])
		}
	})
})

describe("sunlitAzimuthDeg", () => {
	const earth = bodyById.get("earth")!

	for (const days of [0, 91, 182, 273, 9400]) {
		it(`sees Earth from ${EARTH_PHASE_DEG} degrees off the Sun's direction (J2000 + ${days} d)`, () => {
			const jd = J2000 + days
			const p = propagate(earth.orbit!, jd)
			const towardSun = radToDeg(Math.atan2(-p.x, -p.z))
			const az = sunlitAzimuthDeg(jd)
			expect(angleBetween(az, towardSun)).toBeCloseTo(EARTH_PHASE_DEG, 6)
			expect(az).toBeGreaterThanOrEqual(-180)
			expect(az).toBeLessThan(180)
		})
	}
})

describe("turnToward", () => {
	it("takes the shorter way round", () => {
		expect(turnToward(170, -170, 0.5)).toBeCloseTo(-180)
		expect(turnToward(-90, 90, 0)).toBe(-90)
		expect(turnToward(10, 350, 1)).toBeCloseTo(-10)
		expect(turnToward(40, 0, 0.25)).toBeCloseTo(30)
	})
})

describe("hasExplicitView", () => {
	it("is false for a bare link (the language and the reading level do not count)", () => {
		expect(hasExplicitView({})).toBe(false)
		expect(
			hasExplicitView({ lang: "de", reading: "simple" } as Record<
				string,
				unknown
			>),
		).toBe(false)
	})

	it("is true for any view, camera, time, scale, layer or panel in the link", () => {
		expect(hasExplicitView({ focus: "jupiter" })).toBe(true)
		expect(hasExplicitView({ cam: "0_30_2" })).toBe(true)
		expect(hasExplicitView({ t: J2000 })).toBe(true)
		expect(hasExplicitView({ warp: 3600 })).toBe(true)
		expect(hasExplicitView({ scale: "trueScale" })).toBe(true)
		expect(hasExplicitView({ labels: false })).toBe(true)
		expect(hasExplicitView({ frame: "earth" })).toBe(true)
		expect(hasExplicitView({ birthday: true })).toBe(true)
	})
})
