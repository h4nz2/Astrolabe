/** The small bodies and belts of #23 through the data build, on a small fixture. */
import { describe, expect, it } from "vitest"

import { BeltsFile, BodiesFile } from "../../src/data/schema"

import {
	BuildError,
	SMALL_BODY_TEXTURES,
	buildBelts,
	buildBodies,
	hasRealElements,
} from "./build"

const elements = {
	semimajorAxis: 414010000,
	eccentricity: 0.08,
	inclination: 10.6,
	longAscNode: 80.3,
	argPeriapsis: 73.3,
	mainAnomaly: 274.4,
	sideralOrbit: 1679.85,
	epochJD: 2461200.5,
}

const fixture = {
	suns: [
		{
			name: "Sun",
			meanRadius: 695508,
			mass: { massValue: 1.989, massExponent: 30 },
			textures: { base: "/tex/sun.png" },
		},
	],
	planets: [],
	dwarfPlanets: [
		{
			englishName: "Ceres",
			meanRadius: 469.7,
			mass: { massValue: 9.38, massExponent: 20 },
			...elements,
			moons: [
				{
					englishName: "Tiny",
					meanRadius: 5,
					semimajorAxis: 3000,
					sideralOrbit: 2,
					inclination: 5,
					longAscNode: 10,
					argPeriapsis: 20,
					mainAnomaly: 30,
				},
			],
		},
	],
	asteroids: [
		// no phase: a placeholder in the source, left out
		{
			englishName: "Hebe",
			meanRadius: 92,
			semimajorAxis: 362959000,
			sideralOrbit: 1380,
		},
		{
			englishName: "Vesta",
			meanRadius: 262.7,
			...elements,
			semimajorAxis: 353343000,
		},
	],
	comets: [
		{
			englishName: "Halley",
			meanRadius: 5.5,
			...elements,
			semimajorAxis: 2682000000,
			eccentricity: 0.9679,
			tailLengthKmAt1Au: 1.8e7,
		},
		{ englishName: "Shoemaker-Levy 9", meanRadius: 1.2 },
	],
	asteroidBelt: {
		name: "Asteroid belt",
		dots: 100,
		color: "#b8aa90",
		members: { count: 1000, minDiameterKm: 1 },
		meanSeparationKm: 1e6,
		distanceFromParent: { min: 3e8, max: 5e8 },
		zones: [
			{
				share: 1,
				semiMajorAxisAu: [2.1, 3.3],
				eccentricity: [0, 0.2],
				inclinationSigmaDeg: 5,
			},
		],
	},
}

const existing = new Set([
	"/tex/sun.png",
	...Object.values(SMALL_BODY_TEXTURES),
	"/assets/textures/earth/satellites/moon_1k.jpg",
])
const options = {
	fileExists: (path: string) => existing.has(path),
	ringsFor: () => null,
}

describe("small bodies in the build (#23)", () => {
	const result = buildBodies(fixture, options)
	const byId = new Map(result.bodies.map((body) => [body.id, body]))

	it("emits dwarf planets, asteroids and comets with real elements, after everything else", () => {
		expect(BodiesFile.safeParse(result.bodies).success).toBe(true)
		expect(result.bodies.map((body) => [body.id, body.kind])).toEqual([
			["sun", "star"],
			["ceres", "dwarfPlanet"],
			["vesta", "asteroid"],
			["halley", "comet"],
			["tiny", "moon"],
		])
		expect(result.stats.smallBodiesSkipped).toBe(2)
		expect(result.stats.perKind).toMatchObject({
			dwarfPlanet: 1,
			asteroid: 1,
			comet: 1,
			moon: 1,
		})
		expect(result.stats.moonsPerPlanet).toEqual({ ceres: 1 })
	})

	it("keeps each body's own epoch and a curated tail", () => {
		expect(byId.get("ceres")?.orbit?.epochJD).toBe(2461200.5)
		expect(byId.get("halley")?.tail).toEqual({ lengthKmAt1Au: 1.8e7 })
		expect(byId.get("ceres")?.tail).toBeUndefined()
		expect(byId.get("tiny")?.parentId).toBe("ceres")
	})

	it("falls back to stand-in textures for small bodies without a map", () => {
		expect(byId.get("vesta")?.textures.base).toBe(SMALL_BODY_TEXTURES.asteroid)
		expect(byId.get("halley")?.textures.base).toBe(SMALL_BODY_TEXTURES.comet)
	})

	it("asks for a semi-major axis, a period and a phase before emitting a small body", () => {
		expect(hasRealElements(elements)).toBe(true)
		expect(
			hasRealElements({
				...elements,
				longAscNode: 0,
				argPeriapsis: 0,
				mainAnomaly: 0,
			}),
		).toBe(false)
		expect(hasRealElements({ ...elements, sideralOrbit: 0 })).toBe(false)
	})

	it("builds the belts in km with their extent and honest numbers", () => {
		expect(BeltsFile.safeParse(result.belts).success).toBe(true)
		const [belt] = result.belts
		expect(belt).toMatchObject({
			id: "asteroidbelt",
			parentId: "sun",
			dots: 100,
			extentKm: [3e8, 5e8],
			members: { count: 1000, minDiameterKm: 1 },
		})
		expect(belt.zones[0].semiMajorAxisKm[0]).toBe(Math.round(2.1 * 149597870.7))
	})

	it("refuses a belt whose zones do not add up", () => {
		const broken = {
			...fixture,
			asteroidBelt: {
				...fixture.asteroidBelt,
				zones: [{ ...fixture.asteroidBelt.zones[0], share: 0.5 }],
			},
		}
		expect(() => buildBelts(broken, "sun")).toThrow(BuildError)
		expect(buildBelts({}, "sun")).toEqual([])
	})
})
