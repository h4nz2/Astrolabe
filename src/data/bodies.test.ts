import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import type { OurDatabase } from "../../data/ourDB"
import {
	PLACEHOLDER_TEXTURE,
	usesPlaceholderTexture,
} from "../../scripts/lib/build"
import { normalizeName, slug } from "../../scripts/lib/names"
import { spinAxis } from "../sim/rotation"
import { separationDeg } from "../sim/testing/ephemeris"

import {
	bodies,
	bodyById,
	getBody,
	imageCredits,
	moonsOf,
	planets,
	sun,
} from "./index"
import { BodiesFile } from "./schema"

const root = fileURLToPath(new URL("../../", import.meta.url))
const publicDir = join(root, "public")
const rawText = readFileSync(join(root, "src", "data", "bodies.json"), "utf8")
const source = JSON.parse(
	readFileSync(join(root, "data", "ourDB.json"), "utf8"),
) as OurDatabase

const walkNumbers = (value: unknown, path: string, out: string[]): void => {
	if (typeof value === "number") {
		if (!Number.isFinite(value)) out.push(path)
		return
	}
	if (Array.isArray(value)) {
		value.forEach((item, i) => walkNumbers(item, `${path}[${i}]`, out))
	} else if (typeof value === "object" && value !== null) {
		for (const [key, item] of Object.entries(value)) {
			walkNumbers(item, `${path}.${key}`, out)
		}
	}
}

describe("bodies.json", () => {
	it("parses with the zod schema", () => {
		const parsed = BodiesFile.safeParse(JSON.parse(rawText))
		if (!parsed.success) {
			const issues = parsed.error.issues
				.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
				.join("\n")
			expect.fail(`schema issues:\n${issues}`)
		}
		expect(parsed.data).toHaveLength(bodies.length)
	})

	it("has unique ids", () => {
		const ids = bodies.map((body) => body.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it("starts with the Sun, the only star, with no parent", () => {
		expect(bodies[0]).toBe(sun)
		expect(sun).toMatchObject({
			id: "sun",
			kind: "star",
			parentId: null,
			orbit: null,
			rings: null,
		})
		expect(bodies.filter((body) => body.kind === "star")).toHaveLength(1)
	})

	it("is in topological order: every parent exists and appears earlier", () => {
		const seen = new Set<string>()
		for (const body of bodies) {
			if (body.kind === "star") {
				expect(body.parentId).toBeNull()
			} else {
				expect(body.parentId, body.id).not.toBeNull()
				expect(seen.has(body.parentId!), `${body.id} -> ${body.parentId}`).toBe(
					true,
				)
			}
			seen.add(body.id)
		}
	})

	it("lists the eight planets in order of distance, parented to the Sun", () => {
		expect(planets.map((planet) => planet.id)).toEqual([
			"mercury",
			"venus",
			"earth",
			"mars",
			"jupiter",
			"saturn",
			"uranus",
			"neptune",
		])
		for (const planet of planets) {
			expect(planet.parentId).toBe("sun")
			expect(planet.orbit?.phaseSynthetic).toBeUndefined()
			expect(planet.radiusEstimated).toBeUndefined()
		}
	})

	it("emits at least one moon per unique merged source name", () => {
		for (const planet of source.planets) {
			const names = new Set<string>()
			for (const moon of planet.moons ?? []) {
				if (moon.ISS) continue
				const name = moon.englishName ?? moon.name
				if (name) names.add(normalizeName(name))
			}
			for (const satellite of planet.satellites ?? []) {
				names.add(normalizeName(satellite.name))
			}
			const moons = moonsOf(slug(planet.name))
			expect(moons.length, planet.name).toBeGreaterThanOrEqual(names.size)
			for (const moon of moons) {
				expect(moon.kind).toBe("moon")
				expect(moon.parentId).toBe(slug(planet.name))
			}
		}
	})

	it("merges the French and English moon spellings into single bodies", () => {
		const saturnMoons = moonsOf("saturn").map((moon) => moon.id)
		for (const id of [
			"rhea",
			"tethys",
			"dione",
			"enceladus",
			"iapetus",
			"titan",
		]) {
			expect(saturnMoons.filter((moonId) => moonId === id)).toHaveLength(1)
		}
		expect(getBody("europa").textures.base).toBe(
			"/assets/textures/jupiter/satellites/europa.jpg",
		)
		expect(getBody("iapetus").textures.base).toBe(
			"/assets/textures/saturn/satellites/iapetus.jpg",
		)
	})

	it("keeps well-known orbital values", () => {
		const moon = getBody("moon")
		expect(moon.parentId).toBe("earth")
		expect(moon.orbit?.semiMajorAxisKm).toBe(384400)
		expect(moon.orbit?.periodDays).toBeCloseTo(27.32, 1)
		expect(getBody("io").orbit?.periodDays).toBeCloseTo(1.769, 3)
		expect(getBody("earth").orbit?.periodDays).toBeCloseTo(365.256, 3)
	})

	it("carries rings for the four ringed planets and nobody else", () => {
		expect(getBody("saturn").rings).toMatchObject({
			innerRadiusKm: 74510,
			outerRadiusKm: 140220,
		})
		// from data/rings/{jupiter,uranus,neptune}.json (the source has rings: false)
		// Jupiter: the halo's inner edge to the Amalthea gossamer ring's outer edge
		expect(getBody("jupiter").rings).toMatchObject({
			innerRadiusKm: 92000,
			outerRadiusKm: 181350,
		})
		expect(getBody("uranus").rings).toMatchObject({
			innerRadiusKm: 41500,
			outerRadiusKm: 51500,
		})
		expect(getBody("neptune").rings).toMatchObject({
			innerRadiusKm: 40900,
			outerRadiusKm: 63200,
		})
		expect(
			bodies.filter((body) => body.rings !== null).map((b) => b.id),
		).toEqual(["jupiter", "saturn", "uranus", "neptune"])
		for (const body of bodies) {
			if (body.kind !== "planet") expect(body.rings, body.id).toBeNull()
		}
	})

	it("keeps the hand-curated corrections of the source", () => {
		expect(sun.massKg).toBeCloseTo(1.989e30, -27)
		expect(sun.rotation.periodHours).toBeCloseTo(609.12)
		expect(getBody("ananke").name).toBe("Ananke")
		expect(bodyById.has("anake")).toBe(false)
		expect(getBody("phobos").textures).toEqual({
			base: "/assets/textures/mars/satellites/phobos.jpg",
		})
		// typo fixes in the export (see docs/ARCHITECTURE.md, hand-curated corrections)
		expect(getBody("phobos").rotation.periodHours).toBeCloseTo(24 * 0.31891, 2) // synchronous
		expect(getBody("iapetus").rotation.periodHours).toBeCloseTo(24 * 79.33, 1)
		expect(getBody("metis").orbit?.periodDays).toBe(0.29478)
		expect(getBody("deimos").orbit?.periodDays).toBe(1.2624)
		expect(getBody("nereid").orbit).toMatchObject({
			eccentricity: 0.7507,
			inclinationDeg: 7.09,
		})
		expect(getBody("nereid").massKg).toBe(3.1e19)
		expect(getBody("amalthea").massKg).toBe(2.08e18)
		expect(getBody("perdita").massKg).toBe(1.8e16)
		expect(getBody("anthe").radiusKm).toBe(0.9)
		// from the IAU rate 541.1397757 deg/day
		expect(getBody("neptune").rotation.periodHours).toBeCloseTo(15.9663, 3)
	})

	it("uses the JPL/Standish J2000 mean elements for the planets", () => {
		expect(getBody("earth").orbit).toMatchObject({
			semiMajorAxisKm: 149598261,
			eccentricity: 0.01671123,
			inclinationDeg: 0,
			longAscNodeDeg: 0,
			argPeriapsisDeg: 102.93768,
			meanAnomalyDeg: 357.52689,
		})
		expect(getBody("saturn").orbit).toMatchObject({
			eccentricity: 0.05386179,
			argPeriapsisDeg: 338.93645,
			meanAnomalyDeg: 317.35537,
		})
		expect(getBody("neptune").orbit).toMatchObject({
			longAscNodeDeg: 131.78423,
			argPeriapsisDeg: 273.18054,
			meanAnomalyDeg: 259.91521,
		})
	})

	it("encodes retrograde spin once: negative period, tilt to the IAU north pole", () => {
		expect(getBody("venus").rotation).toMatchObject({
			axialTiltDeg: 2.64,
		})
		// the period comes from the IAU rate W1 = -1.4813688 deg/day
		expect(getBody("venus").rotation.periodHours).toBeCloseTo(-5832.44, 2)
		expect(getBody("uranus").rotation).toMatchObject({
			axialTiltDeg: 82.23,
		})
		expect(getBody("uranus").rotation.periodHours).toBeCloseTo(-17.24, 6)
		const retrograde = bodies
			.filter((body) => (body.rotation.periodHours ?? 0) < 0)
			.map((body) => body.id)
		expect(retrograde).toEqual(["venus", "uranus"])
		for (const body of bodies) {
			expect(body.rotation.axialTiltDeg, body.id).toBeGreaterThanOrEqual(0)
			expect(body.rotation.axialTiltDeg, body.id).toBeLessThanOrEqual(90)
		}
		// the dictionary keeps the source obliquity
		expect(getBody("venus").info.axialTilt).toBe(177.36)
		expect(getBody("moon").rotation.axialTiltDeg).toBe(6.68)
	})

	it("carries IAU poles for the Sun, the planets and the Moon, consistent with the source obliquities", () => {
		const withPole = bodies
			.filter((body) => body.rotation.poleRaDeg !== undefined)
			.map((body) => body.id)
		expect(withPole).toEqual([
			"sun",
			"mercury",
			"venus",
			"earth",
			"mars",
			"jupiter",
			"saturn",
			"uranus",
			"neptune",
			"moon",
		])
		const eclipticPole = { x: 0, y: 1, z: 0 } // scene frame
		for (const id of withPole) {
			const body = getBody(id)
			expect(body.rotation.poleDecDeg, id).toBeDefined()
			expect(body.rotation.primeMeridianDeg, id).toBeDefined()
			// the obliquity is measured to the body's orbit, which is at most
			// inclinationDeg away from the ecliptic, so the two tilts agree to that
			const tilt = separationDeg(
				spinAxis(body.rotation, body.orbit),
				eclipticPole,
			)
			const inclination = body.orbit?.inclinationDeg ?? 0
			expect(
				Math.abs(tilt - body.rotation.axialTiltDeg),
				`${id}: pole ${tilt.toFixed(2)} deg from the ecliptic pole, obliquity ${body.rotation.axialTiltDeg}`,
			).toBeLessThanOrEqual(inclination + 0.25)
		}
		expect(
			separationDeg(spinAxis(getBody("earth").rotation, null), eclipticPole),
		).toBeCloseTo(23.4393, 3)
	})

	it("puts regular moons in their planet's equatorial plane (with the rings) and leaves irregular ones to the ecliptic", () => {
		const tiltToParentPole = (id: string): number => {
			const moon = getBody(id)
			const parent = getBody(moon.parentId ?? "")
			return separationDeg(
				spinAxis({ axialTiltDeg: 0 }, moon.orbit), // the orbit normal
				spinAxis(parent.rotation, parent.orbit),
			)
		}
		// source inclinations to the planet's equator survive as the angle to its pole
		expect(tiltToParentPole("titan")).toBeLessThan(0.5)
		expect(tiltToParentPole("rhea")).toBeLessThan(0.5)
		expect(tiltToParentPole("phobos")).toBeLessThan(1.2)
		expect(tiltToParentPole("oberon")).toBeLessThan(0.2)
		expect(tiltToParentPole("triton")).toBeCloseTo(157.345, 1)
		// which puts Uranus's moons almost pole-on to the ecliptic
		expect(getBody("oberon").orbit?.inclinationDeg).toBeGreaterThan(81)
		expect(getBody("titan").orbit?.inclinationDeg).toBeGreaterThan(27)
		// outside the Laplace radius the source inclination is to the ecliptic already
		expect(getBody("iapetus").orbit?.inclinationDeg).toBe(14.72)
		expect(getBody("nereid").orbit?.inclinationDeg).toBe(7.09)
		// the Moon and the Galileans carry curated ecliptic elements and are untouched
		expect(getBody("io").orbit?.inclinationDeg).toBeLessThan(3)
	})

	it("gives every moon its own surface; none but the Moon wears the Moon's map (#37)", () => {
		const moons = bodies.filter((body) => body.kind === "moon")
		const bases = new Set<string>()
		for (const moon of moons) {
			expect(moon.textures, moon.id).toEqual({
				base: `/assets/textures/${moon.parentId}/satellites/${moon.id}.jpg`,
			})
			// the placeholder of the unit fixtures is the Moon's own map
			if (moon.id !== "moon")
				expect(moon.textures.base).not.toBe(PLACEHOLDER_TEXTURE)
			expect(usesPlaceholderTexture(moon), moon.id).toBe(false)
			bases.add(moon.textures.base)
			expect(moon.surface, moon.id).toBeDefined()
			expect(moon.appearance?.color, moon.id).toMatch(/^#[0-9a-f]{6}$/)
			// colours are in the maps: no moon multiplies its map with a tint any more
			expect(moon.appearance?.tint, moon.id).toBeUndefined()
		}
		expect(bases.size).toBe(moons.length)
	})

	it("credits every moon's surface to a source with a recorded licence (#37)", () => {
		const credited = new Map<string, string>()
		for (const credit of imageCredits) {
			expect(credit.licence, credit.id).toMatch(
				/^(Public domain|MIT|No known restrictions)$/,
			)
			for (const id of credit.bodies) credited.set(id, credit.id)
		}
		for (const moon of bodies.filter((body) => body.kind === "moon")) {
			expect(credited.get(moon.id), moon.id).toBe(moon.surface?.source)
		}
	})

	it("maps the featured moons from spacecraft images wherever a free map exists (#37)", () => {
		const kinds = Object.fromEntries(
			bodies
				.filter((body) => body.featured)
				.map((body) => [body.id, body.surface?.kind]),
		)
		// no global map exists of these: Titan's ground is hidden by haze in visible light, and
		// Proteus and Nereid were only glimpsed by Voyager 2
		expect(kinds).toMatchObject({
			titan: "haze",
			proteus: "painted",
			nereid: "painted",
		})
		const painted = Object.entries(kinds).filter(([, kind]) => kind !== "map")
		expect(painted.map(([id]) => id).sort()).toEqual([
			"nereid",
			"proteus",
			"titan",
		])
		// Voyager 2 saw only the southern halves of Uranus's moons and part of Triton
		for (const id of [
			"miranda",
			"ariel",
			"umbriel",
			"titania",
			"oberon",
			"triton",
		]) {
			expect(getBody(id).surface?.filled, id).toBe(true)
		}
		expect(getBody("europa").surface?.filled).toBeUndefined()
	})

	it("carries real J2000 elements for the Moon and the Galilean moons", () => {
		for (const id of ["moon", "io", "europa", "ganymede", "callisto"]) {
			expect(getBody(id).orbit?.phaseSynthetic, id).toBeUndefined()
		}
		expect(getBody("moon").orbit).toMatchObject({
			inclinationDeg: 5.145,
			longAscNodeDeg: 125.045,
			argPeriapsisDeg: 318.309,
			meanAnomalyDeg: 134.963,
		})
		expect(getBody("ganymede").orbit?.periodDays).toBeCloseTo(7.15455, 5)
	})

	it("passes the dictionary fields through info", () => {
		expect(getBody("earth").info).toMatchObject({
			gravity: 9.8,
			diameter: 12756,
			orbitalPeriod: 365.2,
			axialTilt: 23.4393,
			perihelion: 147095000,
			aphelion: 152100000,
		})
		// a numeric 0 means "unknown" in the source and is dropped
		expect(getBody("earth").info).not.toHaveProperty("orbitalInclination")
		expect(getBody("mars").info).toHaveProperty("orbitalInclination")
	})

	it("references only textures that exist under public/", () => {
		const paths = new Set<string>()
		for (const body of bodies) {
			for (const path of Object.values(body.textures)) paths.add(path)
			if (body.rings) {
				paths.add(body.rings.textures.alpha)
				paths.add(body.rings.textures.color)
			}
		}
		expect(paths.size).toBeGreaterThan(0)
		for (const path of paths) {
			expect(path.startsWith("/assets/textures/"), path).toBe(true)
			expect(existsSync(join(publicDir, path)), path).toBe(true)
		}
	})

	it("contains no NaN or infinite numbers", () => {
		expect(rawText).not.toMatch(/NaN|Infinity/)
		const bad: string[] = []
		walkNumbers(JSON.parse(rawText), "bodies", bad)
		expect(bad).toEqual([])
	})

	it("gives every orbiting body a sane orbit and radius", () => {
		for (const body of bodies) {
			expect(body.radiusKm, body.id).toBeGreaterThan(0)
			if (body.kind === "star") continue
			const orbit = body.orbit
			expect(orbit, body.id).not.toBeNull()
			expect(orbit!.periodDays, body.id).toBeGreaterThan(0)
			expect(orbit!.semiMajorAxisKm, body.id).toBeGreaterThan(0)
			expect(orbit!.eccentricity, body.id).toBeGreaterThanOrEqual(0)
			expect(orbit!.eccentricity, body.id).toBeLessThan(1)
			expect(orbit!.epochJD).toBe(2451545)
			for (const key of [
				"longAscNodeDeg",
				"argPeriapsisDeg",
				"meanAnomalyDeg",
			] as const) {
				expect(orbit![key], `${body.id}.${key}`).toBeGreaterThanOrEqual(0)
				expect(orbit![key], `${body.id}.${key}`).toBeLessThan(360)
			}
		}
	})

	it("flags synthetic phases only on moons", () => {
		const synthetic = bodies.filter((body) => body.orbit?.phaseSynthetic)
		expect(synthetic.length).toBeGreaterThan(0)
		for (const body of synthetic) expect(body.kind).toBe("moon")
	})
})
