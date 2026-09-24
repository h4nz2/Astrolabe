import { describe, expect, it } from "vitest"
import type { Spherical } from "three"

import { bodies, getBody } from "@/data"
import { toUnits } from "@/sim"

import {
	CAMERA_NEAR,
	FRAMING_RADII,
	INITIAL_SUN_RADII,
	MIN_DISTANCE_RADII,
	followFocusRadius,
	framingDistance,
	minDollyDistance,
	rescaledDistance,
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

describe("rescaledDistance", () => {
	it("scales the distance with the focus's drawn radius, so the focus keeps its size on screen", () => {
		expect(rescaledDistance(60, 10, 1)).toBeCloseTo(6, 12)
		expect(rescaledDistance(6, 1, 10)).toBeCloseTo(60, 12)
	})

	it("never ends inside the body and survives a zero radius", () => {
		expect(rescaledDistance(1, 1, 100)).toBeGreaterThanOrEqual(
			minDollyDistance(100),
		)
		expect(rescaledDistance(5, 0, 1)).toBe(5)
	})
})

describe("followFocusRadius", () => {
	const makeControls = (distance: number) => {
		const state = { distance, calls: 0 }
		const controls = {
			minDistance: 0,
			dollyTo(d: number) {
				state.distance = Math.max(d, controls.minDistance)
				state.calls++
			},
			getSpherical(out: Spherical) {
				out.radius = state.distance
				return out
			},
		}
		return { controls, state }
	}
	const frameWith = (radii: Record<string, number>) => ({
		index: new Map(Object.keys(radii).map((id, i) => [id, i])),
		renderRadius: (i: number) => Object.values(radii)[i],
	})

	it("remembers the first radius without moving the camera", () => {
		const { controls, state } = makeControls(60)
		const followed = followFocusRadius(
			controls,
			null,
			frameWith({ earth: 10 }),
			"earth",
		)
		expect(followed).toEqual({ id: "earth", radius: 10 })
		expect(state.calls).toBe(0)
	})

	it("dollies in proportion when the same focus changes size (a scale change)", () => {
		const { controls, state } = makeControls(60)
		const followed = followFocusRadius(
			controls,
			{ id: "earth", radius: 10 },
			frameWith({ earth: 1 }),
			"earth",
		)
		expect(followed).toEqual({ id: "earth", radius: 1 })
		expect(state.distance).toBeCloseTo(6, 12)
		// the dolly limit follows the new size before the dolly (which clamps to it)
		expect(controls.minDistance).toBe(minDollyDistance(1))
	})

	it("leaves a focus change and an unchanged radius alone", () => {
		const { controls, state } = makeControls(60)
		const previous = { id: "earth", radius: 10 }
		expect(
			followFocusRadius(
				controls,
				previous,
				frameWith({ earth: 10, mars: 3 }),
				"mars",
			),
		).toEqual({ id: "mars", radius: 3 })
		expect(
			followFocusRadius(controls, previous, frameWith({ earth: 10 }), "earth"),
		).toBe(previous)
		expect(
			followFocusRadius(controls, previous, frameWith({ earth: 10 }), "vulcan"),
		).toBe(previous)
		expect(state.calls).toBe(0)
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
