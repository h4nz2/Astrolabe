import { describe, expect, it } from "vitest"

import { degToRad } from "@/sim"
import { FLIGHT_PROFILE } from "@/store/flight"

import {
	FLIGHT_MAX_MS,
	FLIGHT_MIN_MS,
	FLIGHT_TOP_FIT,
	flightPlan,
	flightProfile,
	transitProfile,
	type TransitInput,
	type TransitSample,
} from "./profiles"

const K = 2 * Math.tan(degToRad(22.5))

/** Earth -> Jupiter in true scale, scene units (1000 km): close-ups 6 radii out, 4.2 AU apart. */
const earthToJupiter: TransitInput = {
	fromDistance: 38.2,
	toDistance: 419,
	separation: 6.28e5,
	widthPerDistance: K,
	aspect: 16 / 9,
}

const sampleAt = (t: number, input: TransitInput): TransitSample =>
	flightProfile.sample(t, input, { pivot: 0, distance: 1, direction: 0 })

describe("the flight profile (#18)", () => {
	it("is registered under the flight's name", () => {
		expect(transitProfile(FLIGHT_PROFILE)).toBe(flightProfile)
	})

	it("climbs until the gap fits the narrow side of the view, and never below either end", () => {
		const plan = flightPlan(earthToJupiter)
		expect(plan.topDistance * K).toBeCloseTo(FLIGHT_TOP_FIT * 6.28e5, 3)
		// a phone held upright: the narrow side is the width
		const portrait = flightPlan({ ...earthToJupiter, aspect: 0.46 })
		expect(portrait.topDistance).toBeCloseTo(plan.topDistance / 0.46, 3)
		// already higher than needed: no climb at all
		const high = flightPlan({ ...earthToJupiter, fromDistance: 1e8 })
		expect(high.topDistance).toBe(1e8)
		expect(high.climb).toBe(0)
		expect(high.climbEnd).toBe(0)
	})

	it("starts exactly where the camera is and ends exactly at the destination", () => {
		expect(sampleAt(0, earthToJupiter)).toEqual({
			pivot: 0,
			distance: 38.2,
			direction: 0,
			lift: 0,
		})
		expect(sampleAt(1, earthToJupiter)).toEqual({
			pivot: 1,
			distance: 419,
			direction: 1,
			lift: 0,
		})
	})

	it("is one continuous move: pull back, travel at the top, descend", () => {
		const plan = flightPlan(earthToJupiter)
		const n = 2000
		let previous = sampleAt(0, earthToJupiter)
		for (let i = 1; i <= n; i++) {
			const t = i / n
			const s = sampleAt(t, earthToJupiter)
			// no jumps: the steepest zoom (mid-climb, about 11 e-folds in a quarter
			// of the time) moves less than a tenth of an e-fold per 1/2000
			expect(Math.abs(Math.log(s.distance / previous.distance))).toBeLessThan(
				0.1,
			)
			expect(Math.abs(s.pivot - previous.pivot)).toBeLessThan(0.005)
			expect(s.pivot).toBeGreaterThanOrEqual(previous.pivot)
			if (t <= plan.climbEnd) {
				expect(s.distance).toBeGreaterThanOrEqual(previous.distance)
			} else if (t < plan.descentStart) {
				expect(s.distance).toBe(plan.topDistance)
			} else {
				expect(s.distance).toBeLessThanOrEqual(previous.distance)
			}
			previous = s
		}
		// most of the time at the top, and almost all of the crossing done there
		expect(plan.descentStart - plan.climbEnd).toBeGreaterThanOrEqual(0.5)
		const crossedAtTop =
			sampleAt(plan.descentStart, earthToJupiter).pivot -
			sampleAt(plan.climbEnd, earthToJupiter).pivot
		expect(crossedAtTop).toBeGreaterThan(0.9)
		// the destination is in view (inside the narrow half-extent) once the top is reached
		const top = sampleAt(plan.climbEnd, earthToJupiter)
		const offset = (1 - top.pivot) * earthToJupiter.separation
		expect(offset).toBeLessThan(0.45 * K * top.distance)
	})

	it("lifts the camera over the middle of the flight", () => {
		expect(sampleAt(0.5, earthToJupiter).lift).toBe(1)
		expect(sampleAt(0.05, earthToJupiter).lift).toBeLessThan(0.1)
		expect(sampleAt(0.95, earthToJupiter).lift).toBeLessThan(0.1)
	})

	it("lasts 2.5-5 s, longer for longer trips", () => {
		const duration = (separation: number) =>
			flightProfile.durationMs!({ ...earthToJupiter, separation })
		expect(duration(0)).toBe(FLIGHT_MIN_MS)
		expect(duration(6.28e5)).toBeGreaterThan(4000)
		// Earth -> Neptune in true scale is about as long as a flight gets
		expect(duration(4.4e6)).toBeGreaterThan(0.98 * FLIGHT_MAX_MS)
		expect(duration(1e8)).toBe(FLIGHT_MAX_MS)
		let previous = 0
		for (const separation of [1e2, 1e3, 1e4, 1e5, 1e6]) {
			const ms = duration(separation)
			expect(ms).toBeGreaterThanOrEqual(previous)
			expect(ms).toBeGreaterThanOrEqual(FLIGHT_MIN_MS)
			expect(ms).toBeLessThanOrEqual(FLIGHT_MAX_MS)
			previous = ms
		}
	})
})
