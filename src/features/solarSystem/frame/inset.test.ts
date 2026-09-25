import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { buildIndex, dateToJD } from "@/sim"

import { insetGeometry } from "./inset"

const index = buildIndex(bodies)
const at = (id: string) => index.get(id)!

describe("insetGeometry", () => {
	const jd = dateToJD(new Date("2025-01-16T00:00Z"))
	const map = insetGeometry(bodies, index, at("earth"), at("mars"), jd, 56)

	it("fits both orbits inside the map", () => {
		expect(map.orbits).toHaveLength(2)
		for (const p of [map.observer, map.target]) {
			expect(Math.hypot(p.x, p.y)).toBeLessThan(56)
		}
		// Earth inside Mars's orbit at true proportions
		expect(Math.hypot(map.target.x, map.target.y)).toBeGreaterThan(
			1.3 * Math.hypot(map.observer.x, map.observer.y),
		)
	})

	it("aims the line of sight from Earth through Mars to the edge", () => {
		const { observer: o, target: t, sightEnd: e } = map
		expect(Math.hypot(e.x, e.y)).toBeCloseTo(56, 6)
		const cross = (t.x - o.x) * (e.y - o.y) - (t.y - o.y) * (e.x - o.x)
		expect(Math.abs(cross)).toBeLessThan(1e-6)
		// at opposition (16 Jan 2025) Earth sits between the Sun and Mars
		const cos =
			(o.x * t.x + o.y * t.y) / (Math.hypot(o.x, o.y) * Math.hypot(t.x, t.y))
		expect(cos).toBeGreaterThan(0.99)
	})

	it("draws the Sun as a target without an orbit of its own", () => {
		const sunMap = insetGeometry(bodies, index, at("earth"), at("sun"), jd, 56)
		expect(sunMap.orbits).toHaveLength(1)
		expect(sunMap.target).toEqual({ x: 0, y: 0 })
	})
})
