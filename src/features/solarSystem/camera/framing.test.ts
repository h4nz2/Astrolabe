import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"
import { AU_KM, degToRad, toUnits } from "@/sim"

import {
	CAMERA_FAR,
	CAMERA_MAX_DISTANCE,
	CAMERA_NEAR,
	FRAMING_RADII,
	MIN_DISTANCE_RADII,
	OVERVIEW_MARGIN,
	OVERVIEW_RADIUS,
	defaultDistance,
	fitDistance,
	minDollyDistance,
	minViewDistance,
	overviewDistance,
	renderedRadius,
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

describe("defaultDistance", () => {
	it("frames every body from 6 of its rendered radii, so all fill the same share of the screen", () => {
		for (const id of ["sun", "jupiter", "mercury", "io"]) {
			const body = getBody(id)
			expect(defaultDistance({ kind: "body", id }, 45, 1.5)).toBe(
				FRAMING_RADII * renderedRadius(body),
			)
		}
		// a point in space uses its anchor's framing
		expect(
			defaultDistance(
				{ kind: "point", anchorId: "mars", offsetKm: [1e6, 0, 0] },
				45,
				1.5,
			),
		).toBe(FRAMING_RADII * renderedRadius(getBody("mars")))
	})

	it("fits the whole planetary system into the overview", () => {
		// Neptune's aphelion, a little over 30 AU
		expect(OVERVIEW_RADIUS * 1000).toBeGreaterThan(30 * AU_KM)
		expect(OVERVIEW_RADIUS * 1000).toBeLessThan(31 * AU_KM)
		const landscape = defaultDistance({ kind: "overview" }, 45, 16 / 9)
		expect(landscape).toBe(overviewDistance(45, 16 / 9))
		// the vertical field of view is the narrower one: the system (and a margin) fills it
		expect(landscape * Math.sin(degToRad(22.5))).toBeCloseTo(
			OVERVIEW_MARGIN * OVERVIEW_RADIUS,
			6,
		)
		// a portrait screen backs further out to fit the width
		const portrait = overviewDistance(45, 0.5)
		expect(portrait).toBeGreaterThan(landscape)
		const halfWidth = Math.atan(Math.tan(degToRad(22.5)) * 0.5)
		expect(portrait * Math.sin(halfWidth)).toBeCloseTo(
			OVERVIEW_MARGIN * OVERVIEW_RADIUS,
			6,
		)
	})

	it("keeps the widest overview well inside the dolly limit and the far plane", () => {
		const narrowest = overviewDistance(45, 0.4)
		expect(narrowest).toBeLessThan(CAMERA_MAX_DISTANCE / 2)
		expect(CAMERA_MAX_DISTANCE + OVERVIEW_RADIUS).toBeLessThan(CAMERA_FAR)
	})

	it("fits a sphere exactly", () => {
		expect(fitDistance(1, 90, 1)).toBeCloseTo(Math.SQRT2, 12)
	})
})

describe("minViewDistance", () => {
	it("keeps the camera outside the body a view is centred on", () => {
		const earth = renderedRadius(getBody("earth"))
		expect(minViewDistance({ kind: "body", id: "earth" })).toBe(
			minDollyDistance(earth),
		)
		expect(minViewDistance({ kind: "overview" })).toBe(
			minDollyDistance(renderedRadius(getBody("sun"))),
		)
		// nothing to crash into at a point in space
		expect(
			minViewDistance({
				kind: "point",
				anchorId: "earth",
				offsetKm: [0, 1e5, 0],
			}),
		).toBe(2 * CAMERA_NEAR)
	})
})
