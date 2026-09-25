import { describe, expect, it } from "vitest"

import { getBody } from "@/data"

import {
	TAIL_FULL_KM,
	TAIL_ONSET_KM,
	antiSunDirection,
	cometActivity,
	nextPerihelionJD,
	previousPerihelionJD,
	tailLengthKm,
} from "./comet"
import { propagate, type Vec3 } from "./kepler"
import { AU_KM } from "./units"

const halley = getBody("halley")
const encke = getBody("encke")
const tail = { lengthKmAt1Au: 1e7 }

describe("comet activity and tail length", () => {
	it("is asleep beyond 4 AU and fully active inside 1.5 AU", () => {
		expect(cometActivity(TAIL_ONSET_KM)).toBe(0)
		expect(cometActivity(30 * AU_KM)).toBe(0)
		expect(cometActivity(TAIL_FULL_KM)).toBe(1)
		expect(cometActivity(0.3 * AU_KM)).toBe(1)
		expect(cometActivity(Number.NaN)).toBe(0)
	})

	it("grows the tail monotonically on the way in and shrinks it on the way out", () => {
		let previous = 0
		for (let au = 6; au >= 0.2; au -= 0.05) {
			const length = tailLengthKm(tail, au * AU_KM)
			expect(length, `${au.toFixed(2)} AU`).toBeGreaterThanOrEqual(previous)
			previous = length
		}
		expect(tailLengthKm(tail, AU_KM)).toBeCloseTo(1e7, 0)
		expect(tailLengthKm(tail, 0.5 * AU_KM)).toBeCloseTo(2e7, 0)
		expect(tailLengthKm(tail, 5 * AU_KM)).toBe(0)
		expect(tailLengthKm(tail, 0)).toBe(0)
	})
})

describe("perihelion passages", () => {
	it("puts Halley's perihelia on 9 Feb 1986 and 28 Jul 2061", () => {
		// 1986-02-09.47 TDB and 2061-07-28 (the predicted return)
		expect(nextPerihelionJD(halley.orbit!, 2446066.5)).toBeCloseTo(
			2446469.97,
			0,
		)
		expect(nextPerihelionJD(halley.orbit!, 2461308.5)).toBeCloseTo(2474034, 0)
		expect(previousPerihelionJD(halley.orbit!, 2461308.5)).toBeCloseTo(
			2446469.97,
			0,
		)
	})

	it("brings Encke back every 3.3 years, next in early 2027", () => {
		const next = nextPerihelionJD(encke.orbit!, 2461308.5)
		// 2027-02-09 +- a week (JPL: 2027-Feb-09)
		expect(Math.abs(next - 2461445.5)).toBeLessThan(7)
		expect(nextPerihelionJD(encke.orbit!, next + 1) - next).toBeCloseTo(
			encke.orbit!.periodDays,
			3,
		)
	})

	it("reaches Halley's perihelion distance of 0.575 AU", () => {
		const at: Vec3 = { x: 0, y: 0, z: 0 }
		propagate(halley.orbit!, 2446469.97, at)
		expect(Math.hypot(at.x, at.y, at.z) / AU_KM).toBeCloseTo(0.575, 3)
	})
})

describe("the tail points away from the Sun", () => {
	const direction = new Float64Array(3)
	const sun = new Float64Array(3)

	/** Dot product of the anti-Sun direction and the comet's velocity at `jd`. */
	const tailAlongMotion = (jd: number): number => {
		const now: Vec3 = { x: 0, y: 0, z: 0 }
		const later: Vec3 = { x: 0, y: 0, z: 0 }
		propagate(halley.orbit!, jd, now)
		propagate(halley.orbit!, jd + 0.01, later)
		antiSunDirection([now.x, now.y, now.z], 0, sun, 0, direction)
		const v = [later.x - now.x, later.y - now.y, later.z - now.z]
		const speed = Math.hypot(v[0], v[1], v[2])
		return (
			(direction[0] * v[0] + direction[1] * v[1] + direction[2] * v[2]) / speed
		)
	}

	it("trails the comet on the way in and leads it on the way out", () => {
		// a month before and after the 1986 perihelion
		expect(tailAlongMotion(2446440)).toBeLessThan(-0.3)
		expect(tailAlongMotion(2446500)).toBeGreaterThan(0.3)
	})

	it("is a unit vector from the Sun through the comet", () => {
		const d = antiSunDirection([3, 4, 0], 0, [0, 0, 0], 0, direction)
		expect(d).toBe(5)
		expect(direction[0]).toBeCloseTo(0.6, 12)
		expect(direction[1]).toBeCloseTo(0.8, 12)
		expect(direction[2]).toBe(0)
		expect(antiSunDirection([1, 1, 1], 0, [1, 1, 1], 0, direction)).toBe(0)
		expect([...direction]).toEqual([0, 0, 0])
	})
})
