import { describe, expect, it } from "vitest"

import { getBody, planets } from "@/data"

import {
	MIN_VISIBLE_PX,
	RING_OPENING,
	fitScale,
	layoutStage,
	stageBody,
	type StageOptions,
} from "./layout"

const row = (...ids: string[]) => ids.map((id) => stageBody(getBody(id)))
const wide: StageOptions = { width: 1200, height: 400, gap: 16, minSlot: 72 }

describe("stageBody", () => {
	it("is the globe for a body without rings", () => {
		const earth = stageBody(getBody("earth"))
		expect(earth.halfWidthKm).toBe(getBody("earth").radiusKm)
		expect(earth.halfHeightKm).toBe(getBody("earth").radiusKm)
	})

	it("makes room for rings, turned by the axial tilt", () => {
		const saturn = getBody("saturn")
		const drawn = stageBody(saturn)
		expect(drawn.radiusKm).toBe(saturn.radiusKm)
		expect(drawn.halfWidthKm).toBeGreaterThan(0.9 * saturn.rings!.outerRadiusKm)
		// Uranus lies on its side: its rings stand upright
		const uranus = stageBody(getBody("uranus"))
		expect(uranus.halfHeightKm).toBeGreaterThan(uranus.halfWidthKm)
		expect(uranus.halfWidthKm).toBeLessThan(
			getBody("uranus").rings!.outerRadiusKm * 2 * RING_OPENING,
		)
	})
})

describe("layoutStage", () => {
	it("draws every body at one scale: the true relative sizes", () => {
		const layout = layoutStage(row("earth", "jupiter"), wide)
		const [earth, jupiter] = layout.items
		expect(jupiter.r / earth.r).toBeCloseTo(
			getBody("jupiter").radiusKm / getBody("earth").radiusKm,
			9,
		)
		// the taller one fills the height
		expect(2 * jupiter.r).toBeCloseTo(400, 6)
		expect(earth.cy).toBe(jupiter.cy)
	})

	it("keeps Earth beside the Sun, too small to see without help", () => {
		const layout = layoutStage(row("sun", "earth"), {
			...wide,
			height: 150,
		})
		const [sun, earth] = layout.items
		expect(sun.r / earth.r).toBeCloseTo(695_508 / 6371.0084, 6)
		expect(earth.tiny).toBe(2 * earth.r < MIN_VISIBLE_PX)
		expect(earth.tiny).toBe(true)
		expect(sun.tiny).toBe(false)
	})

	it("shrinks to fit the width, slots never overlapping", () => {
		const options = { width: 700, height: 500, gap: 12, minSlot: 60 }
		const layout = layoutStage(
			row("sun", ...planets.map((planet) => planet.id)),
			options,
		)
		expect(layout.width).toBeCloseTo(options.width, 6)
		for (let i = 1; i < layout.items.length; i++) {
			const previous = layout.items[i - 1]
			expect(layout.items[i].left).toBeCloseTo(
				previous.left + previous.width + options.gap,
				6,
			)
		}
		for (const item of layout.items) {
			expect(item.width).toBeGreaterThanOrEqual(options.minSlot)
			expect(2 * item.r).toBeLessThanOrEqual(item.width + 1e-9)
		}
	})

	it("scrolls sideways when even the narrowest slots do not fit", () => {
		const options = { width: 320, height: 300, gap: 8, minSlot: 56 }
		const bodies = row("sun", ...planets.map((planet) => planet.id))
		const layout = layoutStage(bodies, options)
		expect(layout.width).toBeGreaterThan(options.width)
		expect(fitScale(bodies, options)).toBeCloseTo(300 / (2 * 695_508), 12)
	})

	it("centres a short row", () => {
		const layout = layoutStage(row("earth", "moon"), wide)
		const left = layout.items[0].left
		const last = layout.items[layout.items.length - 1]
		expect(left).toBeCloseTo(wide.width - (last.left + last.width), 6)
	})
})
