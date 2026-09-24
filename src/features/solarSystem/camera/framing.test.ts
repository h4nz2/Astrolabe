import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"
import { toUnits } from "@/sim"

import {
	CAMERA_NEAR,
	FRAMING_RADII,
	INITIAL_SUN_RADII,
	MIN_DISTANCE_RADII,
	framingDistance,
	minDollyDistance,
} from "./framing"

describe("minDollyDistance", () => {
	it("is 1.2 radii for every body big enough to keep the surface past the near plane", () => {
		const earth = toUnits(getBody("earth").radiusKm)
		expect(minDollyDistance(earth)).toBe(MIN_DISTANCE_RADII * earth)
	})

	it("keeps the eye more than a near plane away from the surface of the smallest moon", () => {
		// S/2009 S 1 has the smallest radius in the data (0.3 km)
		const smallest = bodies.reduce((a, b) => (b.radiusKm < a.radiusKm ? b : a))
		expect(smallest.radiusKm).toBe(0.3)
		const radius = toUnits(smallest.radiusKm)
		expect(minDollyDistance(radius) - radius).toBeGreaterThan(CAMERA_NEAR)
	})

	it("never lets any body's surface reach the near plane at the closest dolly", () => {
		for (const body of bodies) {
			const radius = toUnits(body.radiusKm)
			expect(minDollyDistance(radius) - radius).toBeGreaterThanOrEqual(
				2 * CAMERA_NEAR,
			)
		}
	})

	it("kicks in only for radii below 10 near planes", () => {
		// below 5 * 2 * CAMERA_NEAR / (MIN_DISTANCE_RADII - 1) the near-plane rule wins
		const boundary = (2 * CAMERA_NEAR) / (MIN_DISTANCE_RADII - 1)
		expect(minDollyDistance(boundary * 2)).toBeCloseTo(
			MIN_DISTANCE_RADII * boundary * 2,
			12,
		)
		expect(minDollyDistance(boundary / 2)).toBeCloseTo(
			boundary / 2 + 2 * CAMERA_NEAR,
			12,
		)
	})
})

describe("framingDistance", () => {
	it("frames the Sun from 40 radii on the first mount and 6 radii afterwards", () => {
		expect(framingDistance("star", 1, true)).toBe(INITIAL_SUN_RADII)
		expect(framingDistance("star", 1, false)).toBe(FRAMING_RADII)
	})

	it("frames planets and moons from 6 radii", () => {
		expect(framingDistance("planet", 2, true)).toBe(2 * FRAMING_RADII)
		expect(framingDistance("moon", 3, false)).toBe(3 * FRAMING_RADII)
	})
})
