/**
 * The comparison ideas (#40): each is data (a body list, a group, the fact
 * that makes its point), recognised by its set of bodies, and its teaser's
 * claims hold for the data the page draws.
 */
import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"
import { LOCALES, READING_LEVELS, createI18n } from "@/i18n"
import { dateToJD } from "@/sim"

import { pairFacts } from "./compareFacts"
import {
	COMPARE_PRESET_GROUPS,
	COMPARE_PRESETS,
	parseBodies,
	presetFor,
	promote,
	swapPair,
	addBody,
} from "./selection"

const JD = dateToJD(new Date("2026-09-25T12:00:00Z"))
const en = createI18n({ locale: "en" })
const preset = (id: string) => {
	const found = COMPARE_PRESETS.find((entry) => entry.id === id)
	if (found === undefined) throw new Error(id)
	return found
}
const radius = (id: string) => getBody(id).radiusKm
const mass = (id: string) => getBody(id).massKg ?? 0

describe("the ideas", () => {
	it("are at least a dozen, each in a group, each group used", () => {
		expect(COMPARE_PRESETS.length).toBeGreaterThanOrEqual(13)
		for (const group of COMPARE_PRESET_GROUPS) {
			expect(COMPARE_PRESETS.some((entry) => entry.group === group)).toBe(true)
		}
	})

	it("name only known bodies, and no two share a set of bodies", () => {
		const sets = new Set<string>()
		for (const entry of COMPARE_PRESETS) {
			expect(parseBodies(entry.bodies.join(","))).toEqual(entry.bodies)
			sets.add([...entry.bodies].sort().join(","))
		}
		expect(sets.size).toBe(COMPARE_PRESETS.length)
	})

	it("are recognised by their bodies in any order, and lost when a body is added", () => {
		const twin = preset("earthTwin")
		expect(presetFor(twin.bodies)).toBe(twin)
		expect(presetFor(swapPair(twin.bodies))).toBe(twin)
		const weigh = preset("weighMost")
		expect(presetFor(promote(weigh.bodies, "moon"))).toBe(weigh)
		expect(presetFor(addBody(twin.bodies, "mars"))).toBeUndefined()
		expect(presetFor(["earth", "saturn"])).toBeUndefined()
	})

	it("lead with the comparison that makes their point, in every locale and level", () => {
		for (const locale of LOCALES) {
			for (const readingLevel of READING_LEVELS) {
				const i18n = createI18n({ locale, readingLevel })
				for (const entry of COMPARE_PRESETS) {
					const facts = pairFacts(
						getBody(entry.bodies[0]),
						getBody(entry.bodies[1]),
						i18n,
						{ jd: JD, live: true, lead: entry.lead },
					)
					if (entry.lead !== undefined) expect(facts[0].key).toBe(entry.lead)
					for (const text of [
						i18n.t(`compare.presets.${entry.id}`),
						i18n.t(`compare.teasers.${entry.id}`),
					]) {
						expect(text).not.toMatch(/compare\.|\{|\}/)
					}
				}
			}
		}
	})

	it("keep the rest of the facts in their usual order", () => {
		const plain = pairFacts(getBody("earth"), getBody("jupiter"), en, {
			jd: JD,
			live: true,
		})
		const led = pairFacts(getBody("earth"), getBody("jupiter"), en, {
			jd: JD,
			live: true,
			lead: "weight",
		})
		expect(led.map((fact) => fact.key)).toEqual([
			"weight",
			...plain.map((fact) => fact.key).filter((key) => key !== "weight"),
		])
	})
})

describe("the teasers' claims hold for the data", () => {
	it("Earth's twin: Venus is within 10% of Earth's width and turns slower than it orbits", () => {
		expect(radius("venus") / radius("earth")).toBeGreaterThan(0.9)
		const venus = getBody("venus")
		expect(Math.abs(venus.rotation.periodHours ?? 0) / 24).toBeGreaterThan(
			venus.orbit?.periodDays ?? Infinity,
		)
	})

	it("moons bigger than a planet: Ganymede and Titan outsize Mercury, which outweighs both twice", () => {
		for (const moon of ["ganymede", "titan"]) {
			expect(radius(moon)).toBeGreaterThan(radius("mercury"))
			expect(mass("mercury") / mass(moon)).toBeGreaterThan(2)
		}
	})

	it("Jupiter across the Sun: about 10 Jupiters and 11 Earths", () => {
		expect(Math.round(radius("sun") / radius("jupiter"))).toBe(10)
		expect(Math.round(radius("jupiter") / radius("earth"))).toBe(11)
	})

	it("all planets: Jupiter outweighs the other seven together more than twice", () => {
		const others = bodies
			.filter((body) => body.kind === "planet" && body.id !== "jupiter")
			.reduce((sum, body) => sum + (body.massKg ?? 0), 0)
		expect(mass("jupiter") / others).toBeGreaterThan(2)
	})

	it("the Red Planet is small: each step is about twice as wide", () => {
		expect(Math.round(radius("earth") / radius("mars"))).toBe(2)
		expect(Math.round(radius("mars") / radius("moon"))).toBe(2)
	})

	it("ice giants: about four Earths each, Neptune smaller but heavier", () => {
		for (const giant of ["uranus", "neptune"]) {
			expect(Math.round(radius(giant) / radius("earth"))).toBe(4)
		}
		expect(radius("neptune")).toBeLessThan(radius("uranus"))
		expect(mass("neptune")).toBeGreaterThan(mass("uranus"))
	})

	it("the biggest moons are the seven largest, our Moon fifth", () => {
		const bySize = bodies
			.filter((body) => body.kind === "moon")
			.sort((a, b) => b.radiusKm - a.radiusKm)
			.map((body) => body.id)
		expect(new Set(bySize.slice(0, 7))).toEqual(
			new Set(preset("bigMoons").bodies),
		)
		expect(bySize.indexOf("moon")).toBe(4)
	})

	it("our Moon is unusually big: the largest moon for its planet", () => {
		const ratio = (id: string) => {
			const body = getBody(id)
			return body.radiusKm / getBody(body.parentId ?? "").radiusKm
		}
		const moonsOfPlanets = bodies.filter(
			(body) =>
				body.kind === "moon" && getBody(body.parentId ?? "").kind === "planet",
		)
		for (const other of moonsOfPlanets) {
			if (other.id !== "moon")
				expect(ratio(other.id)).toBeLessThan(ratio("moon"))
		}
		expect(ratio("ganymede")).toBeLessThan(0.04)
	})

	it("Galileo's four: Io, Europa and Ganymede orbit 4 : 2 : 1", () => {
		const period = (id: string) => getBody(id).orbit?.periodDays ?? 0
		expect(Math.round(period("ganymede") / period("io"))).toBe(4)
		expect(Math.round(period("ganymede") / period("europa"))).toBe(2)
	})

	it("potato moons: Phobos about 22 km across, Deimos about 12 km", () => {
		expect(Math.round(2 * radius("phobos"))).toBe(22)
		expect(Math.round(2 * radius("deimos"))).toBe(12)
	})

	it("weigh the most: the Moon about a sixth, Jupiter about two and a half", () => {
		const facts = pairFacts(getBody("earth"), getBody("jupiter"), en, {
			jd: JD,
			live: true,
			lead: "weight",
		})
		expect(facts[0].comparison).toBe(
			"On Jupiter you would weigh 2.5 times as much as on Earth.",
		)
		const moon = pairFacts(getBody("earth"), getBody("moon"), en, {
			jd: JD,
			live: true,
			lead: "weight",
		})
		expect(moon[0].comparison).toBe(
			"On the Moon you would weigh only 17% of what you weigh on Earth.",
		)
	})
})
