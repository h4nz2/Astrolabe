import { describe, expect, it } from "vitest"

import { bodies, getBody, moonsOf, planets } from "@/data"
import { SCALE_PRESETS, displayDistanceKm } from "@/sim"

import { CAMERA_FOV_DEG, FRAMING_RADII, fitDistance } from "../camera/framing"
import {
	SYSTEM_MARGIN,
	moonSystemOf,
	moonSystemShotDistance,
} from "./moonSystem"

describe("the curated moons (#17)", () => {
	it("features the moons with a story, curated by story and not by size", () => {
		const featured = (id: string) =>
			moonSystemOf(id).featured.map((moon) => moon.id)
		expect(featured("earth")).toEqual(["moon"])
		expect(featured("mars")).toEqual(["phobos", "deimos"])
		expect(featured("jupiter")).toEqual([
			"io",
			"europa",
			"ganymede",
			"callisto",
		])
		expect(featured("saturn")).toEqual([
			"mimas",
			"enceladus",
			"tethys",
			"dione",
			"rhea",
			"titan",
			"hyperion",
			"iapetus",
			"phoebe",
		])
		expect(featured("uranus")).toEqual([
			"miranda",
			"ariel",
			"umbriel",
			"titania",
			"oberon",
		])
		expect(featured("neptune")).toEqual(["proteus", "triton", "nereid"])
		// size is not the rule: tiny Deimos is featured, Amalthea (larger) is not
		expect(getBody("deimos").radiusKm).toBeLessThan(
			getBody("amalthea").radiusKm,
		)
		expect(getBody("amalthea").featured).toBeUndefined()
	})

	it("leaves the long tail for the viewer to ask for", () => {
		const all = bodies.filter((body) => body.kind === "moon")
		const featured = all.filter((moon) => moon.featured)
		expect(featured).toHaveLength(24)
		expect(all.length - featured.length).toBeGreaterThan(150)
		expect(moonSystemOf("jupiter").others).toHaveLength(
			moonsOf("jupiter").length - 4,
		)
		expect(moonSystemOf("venus")).toEqual({ featured: [], others: [] })
	})

	it("features only moons", () => {
		expect(
			bodies.filter((body) => body.featured && body.kind !== "moon"),
		).toEqual([])
	})
})

describe("moonSystemShotDistance", () => {
	const scale = SCALE_PRESETS.everythingVisible
	const jupiter = getBody("jupiter")

	it("fits the outermost drawn orbit with a margin", () => {
		const { featured } = moonSystemOf("jupiter")
		const callisto = getBody("callisto").orbit!
		const radii = displayDistanceKm(
			callisto.semiMajorAxisKm * (1 + callisto.eccentricity),
			jupiter.radiusKm,
			1,
			scale.moonDistance,
		)
		expect(
			moonSystemShotDistance(jupiter, featured, scale, 16 / 9),
		).toBeCloseTo(
			fitDistance(SYSTEM_MARGIN * radii, CAMERA_FOV_DEG, 16 / 9) /
				FRAMING_RADII,
			9,
		)
	})

	it("steps back farther for the whole swarm and for true scale", () => {
		const { featured, others } = moonSystemOf("jupiter")
		const story = moonSystemShotDistance(jupiter, featured, scale, 1.5)
		const swarm = moonSystemShotDistance(
			jupiter,
			[...featured, ...others],
			scale,
			1.5,
		)
		expect(swarm).toBeGreaterThan(story)
		expect(
			moonSystemShotDistance(jupiter, featured, SCALE_PRESETS.trueScale, 1.5),
		).toBeGreaterThan(story)
		// a narrow phone screen needs more distance than a wide one
		expect(
			moonSystemShotDistance(jupiter, featured, scale, 0.5),
		).toBeGreaterThan(story)
	})

	it("is never closer than the close-up, and 1 without moons", () => {
		for (const planet of planets) {
			const { featured } = moonSystemOf(planet.id)
			expect(
				moonSystemShotDistance(planet, featured, scale, 1.5),
			).toBeGreaterThanOrEqual(1)
		}
		expect(moonSystemShotDistance(getBody("venus"), [], scale, 1.5)).toBe(1)
	})
})
