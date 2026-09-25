import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { buildIndex, dateToJD } from "@/sim"

import {
	STATIONARY_DEG_PER_DAY,
	apparentMotion,
	apparentRateDegPerDay,
	eclipticLongitude,
	litPath,
	phaseOf,
	type Phase,
} from "./sky"

const index = buildIndex(bodies)
const sky = { bodies, index }
const at = (id: string) => index.get(id)!
const jd = (iso: string) => dateToJD(new Date(iso))
const motion = (observer: string, target: string, iso: string) =>
	apparentMotion(apparentRateDegPerDay(sky, at(observer), at(target), jd(iso)))

describe("apparent motion seen from Earth", () => {
	it("finds Mars's retrograde loop of winter 2024/25 (real: 7 Dec 2024 - 24 Feb 2025)", () => {
		expect(motion("earth", "mars", "2024-10-01T00:00Z")).toBe("prograde")
		expect(motion("earth", "mars", "2024-12-20T00:00Z")).toBe("retrograde")
		expect(motion("earth", "mars", "2025-01-16T00:00Z")).toBe("retrograde")
		expect(motion("earth", "mars", "2025-02-10T00:00Z")).toBe("retrograde")
		expect(motion("earth", "mars", "2025-04-01T00:00Z")).toBe("prograde")
	})

	it("finds the stationary points within a few days of the real ones", () => {
		const rate = (iso: string) =>
			apparentRateDegPerDay(sky, at("earth"), at("mars"), jd(iso))
		// the rate changes sign around 7 Dec 2024 and 24 Feb 2025
		expect(rate("2024-12-02T00:00Z")).toBeGreaterThan(0)
		expect(rate("2024-12-12T00:00Z")).toBeLessThan(0)
		expect(rate("2025-02-19T00:00Z")).toBeLessThan(0)
		expect(rate("2025-03-01T00:00Z")).toBeGreaterThan(0)
		expect(Math.abs(rate("2024-12-07T00:00Z"))).toBeLessThan(
			4 * STATIONARY_DEG_PER_DAY,
		)
	})

	it("finds Venus's retrograde of spring 2025 (real: 2 Mar - 13 Apr 2025)", () => {
		expect(motion("earth", "venus", "2025-01-15T00:00Z")).toBe("prograde")
		expect(motion("earth", "venus", "2025-03-22T00:00Z")).toBe("retrograde")
		expect(motion("earth", "venus", "2025-05-15T00:00Z")).toBe("prograde")
	})

	it("never sees the Sun or the Moon go backwards", () => {
		for (let day = 0; day < 400; day += 7) {
			const t = jd("2025-01-01T00:00Z") + day
			expect(
				apparentRateDegPerDay(sky, at("earth"), at("sun"), t),
			).toBeGreaterThan(0.9)
			expect(
				apparentRateDegPerDay(sky, at("earth"), at("moon"), t),
			).toBeGreaterThan(10)
		}
	})

	it("measures ecliptic longitudes in 0..360", () => {
		// the Sun at the March equinox is at longitude 0, at the June solstice at 90
		const march = eclipticLongitude(
			sky,
			at("earth"),
			at("sun"),
			jd("2025-03-20T09:01Z"),
		)
		expect(Math.min(march, 360 - march)).toBeLessThan(0.5)
		const june = eclipticLongitude(
			sky,
			at("earth"),
			at("sun"),
			jd("2025-06-21T02:42Z"),
		)
		expect(june).toBeCloseTo(90, 0)
	})
})

describe("phases", () => {
	const phase = (iso: string) =>
		phaseOf(sky, at("earth"), at("moon"), at("sun"), jd(iso))

	it("names the real phases of March 2025", () => {
		expect(phase("2025-03-06T16:32Z").id).toBe("firstQuarter")
		const full = phase("2025-03-14T06:55Z")
		expect(full.id).toBe("full")
		expect(full.fraction).toBeGreaterThan(0.97)
		expect(phase("2025-03-22T11:29Z").id).toBe("lastQuarter")
		const newMoon = phase("2025-03-29T10:58Z")
		expect(newMoon.id).toBe("new")
		expect(newMoon.fraction).toBeLessThan(0.03)
	})

	it("waxes before full and wanes after", () => {
		const waxing = phase("2025-03-03T00:00Z")
		expect(waxing).toMatchObject({ id: "waxingCrescent", waxing: true })
		const waning = phase("2025-03-17T00:00Z")
		expect(waning).toMatchObject({ id: "waningGibbous", waxing: false })
		expect(phase("2025-03-06T16:32Z").fraction).toBeCloseTo(0.5, 1)
	})
})

describe("litPath", () => {
	const make = (phaseAngleDeg: number, waxing: boolean): Phase => ({
		id: "full",
		fraction: (1 + Math.cos((phaseAngleDeg * Math.PI) / 180)) / 2,
		phaseAngleDeg,
		waxing,
	})

	it("draws the lit limb on the right while waxing, on the left while waning", () => {
		expect(litPath(make(120, true), 10)).toMatch(/^M 0 -10 A 10 10 0 0 1 0 10/)
		expect(litPath(make(120, false), 10)).toMatch(/^M 0 -10 A 10 10 0 0 0 0 10/)
	})

	it("bulges the terminator into the dark side when gibbous, the lit side as a crescent", () => {
		// waxing gibbous: back up through the left (dark) side, clockwise
		expect(litPath(make(45, true), 10)).toMatch(/A 7\.071 10 0 0 1 0 -10 Z$/)
		// waxing crescent: back up through the right, anticlockwise
		expect(litPath(make(135, true), 10)).toMatch(/A 7\.071 10 0 0 0 0 -10 Z$/)
	})
})
