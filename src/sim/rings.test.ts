import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"

import type { Vec3 } from "./kepler"
import { computePositions } from "./positions"
import {
	RING_MIN_MU,
	ringShadowTransmittance,
	ringU,
	slantOpacity,
} from "./rings"
import { spinAxis } from "./rotation"

const deg = Math.PI / 180

describe("slantOpacity", () => {
	it("is the face-on opacity seen along the pole, and denser at a slant", () => {
		expect(slantOpacity(0.4, 1)).toBeCloseTo(0.4, 12)
		expect(slantOpacity(0.4, -1)).toBeCloseTo(0.4, 12)
		// twice the path: (1 - 0.4)^2 gets through
		expect(slantOpacity(0.4, 0.5)).toBeCloseTo(1 - 0.36, 12)
		expect(slantOpacity(0, 0.1)).toBe(0)
		expect(slantOpacity(1, 0.7)).toBe(1)
	})

	it("stays finite edge-on: an almost transparent ring becomes a dense line", () => {
		const edgeOn = slantOpacity(0.05, 0)
		expect(edgeOn).toBeCloseTo(1 - 0.95 ** (1 / RING_MIN_MU), 12)
		expect(edgeOn).toBeGreaterThan(0.9)
		expect(Number.isFinite(slantOpacity(0.5, 0))).toBe(true)
	})
})

describe("ringShadowTransmittance", () => {
	const pole: Vec3 = { x: 0, y: 1, z: 0 }
	const R = 60_000
	const inner = 1.25 * R
	const outer = 2.3 * R
	// the Sun 20 deg above the ring plane (+Y side), far away along +X
	const elevation = 20 * deg
	const sun: Vec3 = {
		x: 1.4e9 * Math.cos(elevation),
		y: 1.4e9 * Math.sin(elevation),
		z: 0,
	}
	const surface = (latitudeDeg: number): Vec3 => ({
		x: R * Math.cos(latitudeDeg * deg),
		y: R * Math.sin(latitudeDeg * deg),
		z: 0,
	})
	const half = () => 0.5

	it("shades the hemisphere facing away from the Sun's side of the rings", () => {
		// the ray from 25 deg south crosses the plane at 1.6 R: inside the rings
		const t = ringShadowTransmittance(
			surface(-25),
			sun,
			pole,
			inner,
			outer,
			half,
		)
		// (the Sun seen from p is a hair off its direction from the centre)
		expect(t).toBeCloseTo(0.5 ** (1 / Math.sin(elevation)), 4)
		// the Sun's hemisphere, the equator and the far south are clear
		expect(
			ringShadowTransmittance(surface(30), sun, pole, inner, outer, half),
		).toBe(1)
		expect(
			ringShadowTransmittance(surface(0), sun, pole, inner, outer, half),
		).toBe(1)
		expect(
			ringShadowTransmittance(surface(-5), sun, pole, inner, outer, half),
		).toBe(1)
		expect(
			ringShadowTransmittance(surface(-60), sun, pole, inner, outer, half),
		).toBe(1)
	})

	it("passes u across the rings to the opacity profile and lets gaps through", () => {
		const seen: number[] = []
		const gapAt = (u: number) => {
			seen.push(u)
			return u > 0.45 && u < 0.55 ? 0 : 1
		}
		const t = ringShadowTransmittance(
			surface(-25),
			sun,
			pole,
			inner,
			outer,
			gapAt,
		)
		expect(seen).toHaveLength(1)
		const crossing = (seen[0] * (outer - inner) + inner) / R
		expect(crossing).toBeGreaterThan(1.25)
		expect(crossing).toBeLessThan(2.3)
		expect(t === 1 || t === 0).toBe(true)
		expect(ringU(inner, inner, outer)).toBe(0)
		expect(ringU(outer, inner, outer)).toBe(1)
	})

	it("casts nothing when the Sun is in the ring plane (equinox)", () => {
		const equinox: Vec3 = { x: 1.4e9, y: 0, z: 0 }
		for (const lat of [-40, -10, 0, 10, 40]) {
			expect(
				ringShadowTransmittance(
					surface(lat),
					equinox,
					pole,
					inner,
					outer,
					half,
				),
			).toBe(1)
		}
	})
})

describe("Saturn's rings and the Sun", () => {
	const saturnIndex = bodies.findIndex((body) => body.id === "saturn")
	const saturn = getBody("saturn")
	const pole = spinAxis(saturn.rotation, saturn.orbit)
	/** The Sun's elevation over Saturn's ring plane on `jd`, degrees (+ = north). */
	const sunElevation = (jd: number): number => {
		const p = computePositions(bodies, jd)
		const s = saturnIndex * 3
		const x = p[0] - p[s]
		const y = p[1] - p[s + 1]
		const z = p[2] - p[s + 2]
		const d = Math.hypot(x, y, z)
		return Math.asin((x * pole.x + y * pole.y + z * pole.z) / d) / deg
	}

	it("opens the rings fully to the Sun at the 2017 solstice and edge-on at the 2009 equinox", () => {
		// 24 May 2017: northern summer solstice, the Sun 26.7 deg above the rings
		expect(sunElevation(2457897.5)).toBeGreaterThan(25.5)
		expect(sunElevation(2457897.5)).toBeLessThan(27.5)
		// 11 August 2009: equinox, the Sun in the ring plane
		expect(Math.abs(sunElevation(2455054.5))).toBeLessThan(1)
	})

	it("puts the ring shadow on the southern hemisphere in northern summer", () => {
		const p = computePositions(bodies, 2457897.5)
		const s = saturnIndex * 3
		const sun: Vec3 = { x: p[0] - p[s], y: p[1] - p[s + 1], z: p[2] - p[s + 2] }
		const rings = saturn.rings
		if (rings === null) throw new Error("Saturn has rings")
		const R = saturn.radiusKm
		// the sub-solar meridian: the Sun's direction without its polar part
		const sunDir = Math.hypot(sun.x, sun.y, sun.z)
		const up = (sun.x * pole.x + sun.y * pole.y + sun.z * pole.z) / sunDir
		const e = {
			x: sun.x / sunDir - up * pole.x,
			y: sun.y / sunDir - up * pole.y,
			z: sun.z / sunDir - up * pole.z,
		}
		const el = Math.hypot(e.x, e.y, e.z)
		const at = (latDeg: number): Vec3 => {
			const c = Math.cos(latDeg * deg) / el
			const n = Math.sin(latDeg * deg)
			return {
				x: R * (e.x * c + pole.x * n),
				y: R * (e.y * c + pole.y * n),
				z: R * (e.z * c + pole.z * n),
			}
		}
		const opaque = () => 1
		const shade = (lat: number) =>
			ringShadowTransmittance(
				at(lat),
				sun,
				pole,
				rings.innerRadiusKm,
				rings.outerRadiusKm,
				opaque,
			)
		const south = [-10, -20, -30, -40, -50].map(shade)
		const north = [10, 20, 30, 40, 50].map(shade)
		expect(south.some((t) => t === 0)).toBe(true)
		expect(north.every((t) => t === 1)).toBe(true)
	})
})
