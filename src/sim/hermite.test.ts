import { describe, expect, it } from "vitest"

import { bracket, hermitePosition, hermiteVelocity } from "./hermite"
import { SECONDS_PER_DAY } from "./units"

describe("hermitePosition / hermiteVelocity", () => {
	// a cubic in time (km, t in days) is reproduced exactly from its ends
	const cubic = (t: number) => 3 + 2 * t - 5 * t * t + 0.5 * t * t * t
	const slope = (t: number) => (2 - 10 * t + 1.5 * t * t) / SECONDS_PER_DAY
	const times = [1, 4]
	const positions = [cubic(1), 0, -cubic(1), cubic(4), 0, -cubic(4)]
	const velocities = [slope(1), 0, -slope(1), slope(4), 0, -slope(4)]

	it("reproduces a cubic exactly, with its derivative", () => {
		const p = [0, 0, 0]
		const v = [0, 0, 0]
		for (const t of [1, 1.5, 2.25, 3.9, 4]) {
			hermitePosition(times, positions, velocities, 0, 1, t, p)
			hermiteVelocity(times, positions, velocities, 0, 1, t, v)
			expect(p[0]).toBeCloseTo(cubic(t), 9)
			expect(p[2]).toBeCloseTo(-cubic(t), 9)
			expect(v[0] * SECONDS_PER_DAY).toBeCloseTo(slope(t) * SECONDS_PER_DAY, 9)
		}
	})

	it("returns the first sample for a zero-length interval", () => {
		const p = [0, 0, 0]
		hermitePosition([2, 2], [1, 2, 3, 4, 5, 6], [0, 0, 0, 0, 0, 0], 0, 1, 2, p)
		expect(p).toEqual([1, 2, 3])
	})

	it("follows a circular orbit closely with few samples", () => {
		// 16 samples per revolution of a 1-day circle of radius 1000 km
		const n = 16
		const w = (2 * Math.PI) / SECONDS_PER_DAY
		const t = Array.from({ length: n + 1 }, (_, k) => k / n)
		const p = t.flatMap((d) => [
			1000 * Math.cos(2 * Math.PI * d),
			1000 * Math.sin(2 * Math.PI * d),
			0,
		])
		const v = t.flatMap((d) => [
			-1000 * w * Math.sin(2 * Math.PI * d),
			1000 * w * Math.cos(2 * Math.PI * d),
			0,
		])
		const out = [0, 0, 0]
		let worst = 0
		for (let d = 0; d < 1; d += 0.001) {
			const i = bracket(t, d)
			hermitePosition(t, p, v, i, i + 1, d, out)
			worst = Math.max(worst, Math.abs(Math.hypot(out[0], out[1]) - 1000))
		}
		expect(worst).toBeLessThan(0.1)
	})
})

describe("bracket", () => {
	const times = [0, 1, 2, 5, 10]
	it("finds the interval holding t", () => {
		expect(bracket(times, 0)).toBe(0)
		expect(bracket(times, 0.5)).toBe(0)
		expect(bracket(times, 1)).toBe(1)
		expect(bracket(times, 4.9)).toBe(2)
		expect(bracket(times, 9.99)).toBe(3)
	})
	it("clamps outside the range", () => {
		expect(bracket(times, -3)).toBe(0)
		expect(bracket(times, 10)).toBe(3)
		expect(bracket(times, 99)).toBe(3)
	})
})
