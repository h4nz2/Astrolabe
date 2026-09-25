import { describe, expect, it } from "vitest"

import {
	LONG_TAIL_ORBIT_FACTOR,
	ORBIT_FADE_FULL_PX,
	ORBIT_FADE_START_PX,
	moonOrbitFade,
	orbitScreenRadiusPx,
} from "./moonOrbitFade"

const featured = { featured: true } as const
const longTail = {}

describe("orbitScreenRadiusPx", () => {
	it("shrinks with the distance to the parent", () => {
		expect(orbitScreenRadiusPx(1, 10, 500)).toBe(50)
		expect(orbitScreenRadiusPx(1, 100, 500)).toBe(5)
	})

	it("is infinite with the camera at the parent", () => {
		expect(orbitScreenRadiusPx(1, 0, 500)).toBe(Number.POSITIVE_INFINITY)
	})
})

describe("moonOrbitFade", () => {
	it("hides an orbit that is only a few pixels wide", () => {
		expect(moonOrbitFade(0, featured)).toBe(0)
		expect(moonOrbitFade(ORBIT_FADE_START_PX, featured)).toBe(0)
	})

	it("fades in smoothly and monotonically as the system grows on screen", () => {
		let previous = 0
		for (let px = ORBIT_FADE_START_PX; px <= ORBIT_FADE_FULL_PX; px += 1) {
			const fade = moonOrbitFade(px, featured)
			expect(fade).toBeGreaterThanOrEqual(previous)
			previous = fade
		}
		expect(moonOrbitFade(ORBIT_FADE_FULL_PX, featured)).toBe(1)
		expect(moonOrbitFade(1e9, featured)).toBe(1)
		expect(moonOrbitFade(Number.POSITIVE_INFINITY, featured)).toBe(1)
	})

	it("draws the long tail fainter than the featured moons", () => {
		expect(moonOrbitFade(1e9, longTail)).toBe(LONG_TAIL_ORBIT_FACTOR)
		expect(LONG_TAIL_ORBIT_FACTOR).toBeLessThan(1)
	})
})
