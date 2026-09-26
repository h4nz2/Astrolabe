import { describe, expect, it } from "vitest"

import { belts, sun } from "@/data"

import {
	beltDotPositionKm,
	generateBeltOrbits,
	hashSeed,
	seededRandom,
	zoneCounts,
} from "./belts"
import { AU_KM } from "./units"

const beltOf = (id: string) => {
	const belt = belts.find((b) => b.id === id)
	if (belt === undefined) throw new Error(id)
	return belt
}
const asteroidBelt = beltOf("asteroidbelt")
const kuiperBelt = beltOf("kuiperbelt")
const massKg = sun.massKg!

describe("belt dots", () => {
	it("are the same every time (seeded, never Math.random)", () => {
		const a = generateBeltOrbits(asteroidBelt, massKg)
		const b = generateBeltOrbits(asteroidBelt, massKg)
		expect(a.elements).toEqual(b.elements)
		expect(a.periapsis).toEqual(b.periapsis)
		expect(hashSeed("asteroidbelt")).toBe(hashSeed("asteroidbelt"))
		const random = seededRandom(1)
		for (let i = 0; i < 100; i++) {
			const x = random()
			expect(x).toBeGreaterThanOrEqual(0)
			expect(x).toBeLessThan(1)
		}
	})

	it("give every zone its share and nothing more", () => {
		for (const belt of belts) {
			const counts = zoneCounts(belt)
			expect(counts.reduce((sum, n) => sum + n, 0)).toBe(belt.dots)
			counts.forEach((n, z) =>
				expect(Math.abs(n - belt.zones[z].share * belt.dots)).toBeLessThan(2),
			)
		}
	})

	it("stay inside their zones: Kirkwood gaps empty, Kuiper orbits clear of Neptune", () => {
		for (const belt of [asteroidBelt, kuiperBelt]) {
			const orbits = generateBeltOrbits(belt, massKg)
			const counts = zoneCounts(belt)
			let k = 0
			belt.zones.forEach((zone, z) => {
				for (let d = 0; d < counts[z]; d++, k++) {
					const a = orbits.elements[k * 4]
					const e = orbits.elements[k * 4 + 1]
					// float32 storage: a relative tolerance
					expect(a).toBeGreaterThanOrEqual(zone.semiMajorAxisKm[0] * 0.9999)
					expect(a).toBeLessThanOrEqual(zone.semiMajorAxisKm[1] * 1.0001)
					expect(e).toBeLessThan(1)
					if (zone.perihelionMinKm !== undefined) {
						expect(a * (1 - e)).toBeGreaterThanOrEqual(
							zone.perihelionMinKm * 0.999,
						)
					}
				}
			})
		}
		// the 3:1 Kirkwood gap with Jupiter at 2.50 AU holds no dot
		const main = generateBeltOrbits(asteroidBelt, massKg)
		for (let k = 0; k < main.count; k++) {
			const au = main.elements[k * 4] / AU_KM
			expect(au > 2.495 && au < 2.515, `dot ${k} at ${au} AU`).toBe(false)
		}
	})

	it("move on Kepler orbits: a dot at 2.5 AU goes round in about 4 years", () => {
		const orbits = generateBeltOrbits(asteroidBelt, massKg)
		const out = new Float64Array(3)
		for (let k = 0; k < orbits.count; k += 97) {
			const a = orbits.elements[k * 4]
			const e = orbits.elements[k * 4 + 1]
			const n = orbits.elements[k * 4 + 2]
			// Kepler's third law: P^2 = a^3 in years and AU
			const years = (2 * Math.PI) / n / 365.25
			expect(years).toBeCloseTo((a / AU_KM) ** 1.5, 1)
			for (const days of [0, 1000, -5000]) {
				beltDotPositionKm(orbits, k, days, out)
				const r = Math.hypot(out[0], out[1], out[2])
				expect(r).toBeGreaterThanOrEqual(a * (1 - e) * 0.9999)
				expect(r).toBeLessThanOrEqual(a * (1 + e) * 1.0001)
			}
		}
	})

	it("state honest numbers: each asteroid-belt dot stands for hundreds of asteroids a million km apart", () => {
		const perDot = asteroidBelt.members.count / asteroidBelt.dots
		expect(perDot).toBeGreaterThan(100)
		expect(asteroidBelt.members.minDiameterKm).toBe(1)
		// neighbours are more than twice as far apart as the Moon is from Earth
		expect(asteroidBelt.meanSeparationKm / 384400).toBeGreaterThan(2)
		expect(kuiperBelt.meanSeparationKm).toBeGreaterThan(
			asteroidBelt.meanSeparationKm,
		)
	})
})
