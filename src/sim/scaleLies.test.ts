import { describe, expect, it } from "vitest"

import { bodies, getBody, planets, sun } from "@/data"

import {
	SCALE_PRESETS,
	SCALE_PRESET_IDS,
	TRUE_SCALE,
	type ScalePresetId,
} from "./scale"
import { SCALE_LIES, bodyDistortion, presetForLies } from "./scaleLies"

const distortion = (id: string, preset: ScalePresetId) => {
	const body = getBody(id)
	return bodyDistortion(
		body,
		body.parentId === null ? null : getBody(body.parentId),
		sun.radiusKm,
		SCALE_PRESETS[preset],
	)
}

describe("the sizes x distances grid", () => {
	it("gives every preset its own cell and every cell a preset", () => {
		const cells = SCALE_PRESET_IDS.map(
			(id) => `${SCALE_LIES[id].sizes}/${SCALE_LIES[id].distances}`,
		)
		expect(new Set(cells).size).toBe(4)
		for (const sizes of ["true", "enlarged"] as const) {
			for (const distances of ["true", "squeezed"] as const) {
				const id = presetForLies({ sizes, distances })
				expect(SCALE_LIES[id]).toEqual({ sizes, distances })
			}
		}
		expect(presetForLies({ sizes: "true", distances: "true" })).toBe(
			"trueScale",
		)
		expect(presetForLies({ sizes: "enlarged", distances: "squeezed" })).toBe(
			"everythingVisible",
		)
	})

	it("matches what each preset really does to the planets", () => {
		for (const id of SCALE_PRESET_IDS) {
			for (const planet of planets) {
				const d = distortion(planet.id, id)
				// sizes: true means exactly true, enlarged means every planet grows
				if (SCALE_LIES[id].sizes === "true") expect(d.size).toBe(1)
				else expect(d.size).toBeGreaterThan(2)
				// distances from the Sun: true means exactly true, squeezed pulls every planet in
				if (SCALE_LIES[id].distances === "true")
					expect(d.distance).toBeCloseTo(1, 12)
				else expect(d.distance).toBeLessThan(0.2)
			}
		}
	})
})

describe("bodyDistortion", () => {
	it("is the identity at true scale, for every body", () => {
		for (const body of bodies) {
			const d = bodyDistortion(
				body,
				body.parentId === null ? null : getBody(body.parentId),
				sun.radiusKm,
				TRUE_SCALE,
			)
			expect(d.size).toBe(1)
			expect(d.distance).toBeCloseTo(1, 12)
		}
	})

	it("states the default's lies about Earth: about 10x too big, 13x too close to the Sun", () => {
		const earth = distortion("earth", "everythingVisible")
		expect(earth.size).toBeCloseTo(10.45, 1)
		expect(1 / earth.distance).toBeCloseTo(13.2, 1)
		// Neptune: the issue's "distances 67x closer"
		expect(1 / distortion("neptune", "everythingVisible").distance).toBeCloseTo(
			67.5,
			0,
		)
	})

	it("measures a moon against its planet, in kilometres", () => {
		// the Moon is gathered to 7.9 drawn Earth radii, but Earth is drawn 10x too big:
		// in kilometres it ends up a little farther out than in reality
		const moon = distortion("moon", "everythingVisible")
		expect(moon.distance).toBeGreaterThan(1.2)
		expect(moon.distance).toBeLessThan(1.6)
	})

	it("leaves the root's distance at 1: the Sun is always drawn true", () => {
		expect(distortion("sun", "everythingVisible")).toEqual({
			size: 1,
			distance: 1,
		})
	})
})
