import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"
import { AU_KM, SCALE_PRESETS, TRUE_SCALE, degToRad, toUnits } from "@/sim"

import { createSimFrame } from "../scene/simFrame"
import {
	CAMERA_FAR,
	CAMERA_MAX_DISTANCE,
	CAMERA_NEAR,
	FRAMING_RADII,
	MIN_DISTANCE_RADII,
	OVERVIEW_MARGIN,
	defaultDistance,
	fitDistance,
	minDollyDistance,
	minViewDistance,
	overviewDistance,
	overviewRadius,
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

const trueFrame = createSimFrame(bodies, undefined, TRUE_SCALE)
const visibleFrame = createSimFrame(
	bodies,
	undefined,
	SCALE_PRESETS.everythingVisible,
)
const drawn = (frame: typeof trueFrame, id: string) =>
	frame.renderRadius(frame.index.get(id)!)

describe("defaultDistance", () => {
	it("frames every body from 6 of its drawn radii, so all fill the same share of the screen", () => {
		for (const frame of [trueFrame, visibleFrame]) {
			for (const id of ["sun", "jupiter", "mercury", "io"]) {
				expect(defaultDistance({ kind: "body", id }, frame, 45, 1.5)).toBe(
					FRAMING_RADII * drawn(frame, id),
				)
			}
			// a point in space uses its anchor's framing
			expect(
				defaultDistance(
					{ kind: "point", anchorId: "mars", offsetKm: [1e6, 0, 0] },
					frame,
					45,
					1.5,
				),
			).toBe(FRAMING_RADII * drawn(frame, "mars"))
			// a point in interplanetary space (anchored to the Sun) is framed like the overview
			expect(
				defaultDistance(
					{ kind: "point", anchorId: "sun", offsetKm: [2e8, 0, 0] },
					frame,
					45,
					1.5,
				),
			).toBe(defaultDistance({ kind: "overview" }, frame, 45, 1.5))
		}
		// drawn, not true: Earth is enlarged in the default preset
		expect(drawn(visibleFrame, "earth")).toBeGreaterThan(
			toUnits(getBody("earth").radiusKm) * 5,
		)
	})

	it("fits the whole planetary system, as drawn, into the overview", () => {
		// Neptune's aphelion, a little over 30 AU at true scale
		const radius = overviewRadius(TRUE_SCALE)
		expect(radius * 1000).toBeGreaterThan(30 * AU_KM)
		expect(radius * 1000).toBeLessThan(31 * AU_KM)
		// the default preset pulls the far orbits in
		expect(overviewRadius(SCALE_PRESETS.everythingVisible)).toBeLessThan(
			radius / 10,
		)
		const landscape = defaultDistance(
			{ kind: "overview" },
			trueFrame,
			45,
			16 / 9,
		)
		expect(landscape).toBe(overviewDistance(TRUE_SCALE, 45, 16 / 9))
		// the vertical field of view is the narrower one: the system (and a margin) fills it
		expect(landscape * Math.sin(degToRad(22.5))).toBeCloseTo(
			OVERVIEW_MARGIN * radius,
			6,
		)
		// a portrait screen backs further out to fit the width
		const portrait = overviewDistance(TRUE_SCALE, 45, 0.5)
		expect(portrait).toBeGreaterThan(landscape)
		const halfWidth = Math.atan(Math.tan(degToRad(22.5)) * 0.5)
		expect(portrait * Math.sin(halfWidth)).toBeCloseTo(
			OVERVIEW_MARGIN * radius,
			6,
		)
	})

	it("keeps the widest true-scale overview inside the dolly limit and the far plane", () => {
		const narrowest = overviewDistance(TRUE_SCALE, 45, 0.4)
		expect(narrowest).toBeLessThan(CAMERA_MAX_DISTANCE / 2)
		expect(CAMERA_MAX_DISTANCE + overviewRadius(TRUE_SCALE)).toBeLessThan(
			CAMERA_FAR,
		)
	})

	it("fits a sphere exactly", () => {
		expect(fitDistance(1, 90, 1)).toBeCloseTo(Math.SQRT2, 12)
	})
})

describe("minViewDistance", () => {
	it("keeps the camera outside the drawn body a view is centred on", () => {
		expect(minViewDistance({ kind: "body", id: "earth" }, visibleFrame)).toBe(
			minDollyDistance(drawn(visibleFrame, "earth")),
		)
		expect(minViewDistance({ kind: "overview" }, trueFrame)).toBe(
			minDollyDistance(drawn(trueFrame, "sun")),
		)
		// a point in space takes the limits of the body whose neighbourhood it is in
		expect(
			minViewDistance(
				{ kind: "point", anchorId: "earth", offsetKm: [0, 1e5, 0] },
				trueFrame,
			),
		).toBe(minDollyDistance(drawn(trueFrame, "earth")))
		expect(
			minViewDistance(
				{ kind: "point", anchorId: "mercury", offsetKm: [0, 1e4, 0] },
				trueFrame,
			),
		).toBeLessThan(
			minViewDistance(
				{ kind: "point", anchorId: "sun", offsetKm: [1e8, 0, 0] },
				trueFrame,
			) / 100,
		)
	})
})
