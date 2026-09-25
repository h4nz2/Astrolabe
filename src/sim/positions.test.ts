import {
	Body as AeBody,
	GeoMoonState,
	JupiterMoons,
	MakeTime,
	RotateState,
	Rotation_EQJ_ECL,
	type StateVector,
} from "astronomy-engine"
import { describe, expect, it } from "vitest"

import { bodies as realBodies, getBody } from "@/data"

import {
	eclipticToScene,
	propagate,
	type OrbitElements,
	type Vec3,
} from "./kepler"
import {
	buildIndex,
	computePositions,
	relativePosition,
	relativeToOrigin,
	type OrbitingBody,
} from "./positions"
import { ephemerisEclipticKm, length, separationDeg } from "./testing/ephemeris"
import { J2000_JD, jdToDate } from "./time"
import { AU_KM, toUnits } from "./units"

const earthOrbit: OrbitElements = {
	semiMajorAxisKm: 149598023,
	eccentricity: 0.0167,
	inclinationDeg: 0,
	longAscNodeDeg: -11.261,
	argPeriapsisDeg: 114.208,
	meanAnomalyDeg: 358.617,
	periodDays: 365.256,
	epochJD: J2000_JD,
}

const moonOrbit: OrbitElements = {
	semiMajorAxisKm: 384400,
	eccentricity: 0.0549,
	inclinationDeg: 5.145,
	longAscNodeDeg: 125.08,
	argPeriapsisDeg: 318.15,
	meanAnomalyDeg: 135.27,
	periodDays: 27.321661,
	epochJD: J2000_JD,
}

const marsOrbit: OrbitElements = {
	semiMajorAxisKm: 227939200,
	eccentricity: 0.0934,
	inclinationDeg: 1.85,
	longAscNodeDeg: 49.558,
	argPeriapsisDeg: 286.502,
	meanAnomalyDeg: 19.373,
	periodDays: 686.98,
	epochJD: J2000_JD,
}

const bodies: readonly OrbitingBody[] = [
	{ id: "sun", parentId: null, orbit: null },
	{ id: "earth", parentId: "sun", orbit: earthOrbit },
	{ id: "moon", parentId: "earth", orbit: moonOrbit },
	{ id: "mars", parentId: "sun", orbit: marsOrbit },
]

const jd = J2000_JD + 123.456

/** Exact double equality that, unlike toBe()/Object.is, treats -0 and +0 as the same value. */
const expectSame = (actual: number, expected: number): void => {
	expect(actual === expected, `${actual} !== ${expected}`).toBe(true)
}

describe("buildIndex", () => {
	it("maps ids to array indices", () => {
		const index = buildIndex(bodies)
		expect([...index.entries()]).toEqual([
			["sun", 0],
			["earth", 1],
			["moon", 2],
			["mars", 3],
		])
	})

	it("rejects duplicate ids", () => {
		expect(() =>
			buildIndex([{ id: "io" }, { id: "europa" }, { id: "io" }]),
		).toThrow(/duplicate body id "io"/)
	})
})

describe("computePositions", () => {
	it("writes 3 doubles per body, parents first", () => {
		const out = computePositions(bodies, jd)
		expect(out).toBeInstanceOf(Float64Array)
		expect(out.length).toBe(bodies.length * 3)

		// the root sits at the world origin
		expect([out[0], out[1], out[2]]).toEqual([0, 0, 0])

		// a planet is exactly propagate(orbit) relative to the Sun
		const earth = propagate(earthOrbit, jd)
		expectSame(out[3], earth.x)
		expectSame(out[4], earth.y)
		expectSame(out[5], earth.z)

		// a moon is parent world position + its own parent-centric position
		const moon = propagate(moonOrbit, jd)
		expectSame(out[6], earth.x + moon.x)
		expectSame(out[7], earth.y + moon.y)
		expectSame(out[8], earth.z + moon.z)

		const mars = propagate(marsOrbit, jd)
		expectSame(out[9], mars.x)
		expectSame(out[10], mars.y)
		expectSame(out[11], mars.z)
	})

	it("places the Moon within its orbit radius of the Earth, far from the Sun", () => {
		const out = computePositions(bodies, jd)
		const dEarthMoon = Math.hypot(
			out[6] - out[3],
			out[7] - out[4],
			out[8] - out[5],
		)
		expect(dEarthMoon).toBeGreaterThan(384400 * (1 - 0.0549) - 1)
		expect(dEarthMoon).toBeLessThan(384400 * (1 + 0.0549) + 1)
		const dSunMoon = Math.hypot(out[6], out[7], out[8])
		expect(dSunMoon).toBeGreaterThan(1.4e8)
	})

	it("reuses `out` when it is large enough and allocates otherwise", () => {
		const big = new Float64Array(bodies.length * 3 + 6).fill(NaN)
		expect(computePositions(bodies, jd, big)).toBe(big)
		expect(Number.isNaN(big[0])).toBe(false)
		expect(Number.isNaN(big[bodies.length * 3])).toBe(true) // untouched tail

		const small = new Float64Array(3)
		const fresh = computePositions(bodies, jd, small)
		expect(fresh).not.toBe(small)
		expect(fresh.length).toBe(bodies.length * 3)
	})

	it("accepts a prebuilt index", () => {
		const index = buildIndex(bodies)
		const a = computePositions(bodies, jd)
		const b = computePositions(bodies, jd, undefined, index)
		expect(Array.from(b)).toEqual(Array.from(a))
	})

	it("rejects an index built from a different array", () => {
		const partial = buildIndex(bodies.slice(0, 2))
		expect(() => computePositions(bodies, jd, undefined, partial)).toThrow(
			/index has 2 entries for 4 bodies/,
		)
	})

	it("puts a body without an orbit on top of its parent", () => {
		const out = computePositions(
			[...bodies, { id: "iss", parentId: "earth", orbit: null }],
			jd,
		)
		expect([out[12], out[13], out[14]]).toEqual([out[3], out[4], out[5]])
	})

	it("throws on an unknown parent or a non-topological order", () => {
		expect(() =>
			computePositions(
				[{ id: "phobos", parentId: "mars", orbit: marsOrbit }],
				jd,
			),
		).toThrow(/unknown parent "mars"/)
		expect(() =>
			computePositions(
				[
					{ id: "moon", parentId: "earth", orbit: moonOrbit },
					{ id: "earth", parentId: null, orbit: null },
				],
				jd,
			),
		).toThrow(/not in topological order/)
	})
})

describe("floating origin", () => {
	const positions = computePositions(bodies, jd)
	const index = buildIndex(bodies)
	const earth = index.get("earth") ?? -1
	const moon = index.get("moon") ?? -1
	const sun = index.get("sun") ?? -1

	it("gives the parent-centric position in scene units when the origin is the parent", () => {
		const rel = relativePosition(positions, moon, earth)
		const local = propagate(moonOrbit, jd)
		expect(rel).toBeInstanceOf(Float64Array)
		expect(rel[0]).toBeCloseTo(toUnits(local.x), 9)
		expect(rel[1]).toBeCloseTo(toUnits(local.y), 9)
		expect(rel[2]).toBeCloseTo(toUnits(local.z), 9)
	})

	it("is antisymmetric and zero against itself", () => {
		const ab = relativePosition(positions, earth, moon)
		const ba = relativePosition(positions, moon, earth)
		expect(ab[0]).toBeCloseTo(-ba[0], 12)
		expect(ab[1]).toBeCloseTo(-ba[1], 12)
		expect(ab[2]).toBeCloseTo(-ba[2], 12)
		expect(Array.from(relativePosition(positions, earth, earth))).toEqual([
			0, 0, 0,
		])
	})

	it("writes into and returns the given target (arrays and typed arrays)", () => {
		const arr: number[] = [NaN, NaN, NaN]
		expect(relativePosition(positions, earth, sun, arr)).toBe(arr)
		expect(arr[0]).toBe(toUnits(positions[3]))
		const f32 = new Float32Array(3)
		expect(relativePosition(positions, earth, sun, f32)).toBe(f32)
		expect(f32[2]).toBeCloseTo(toUnits(positions[5]), 0)
	})

	it("keeps double precision: Moon relative to Earth is exact to the metre", () => {
		// Sun-centred Moon coordinate is ~1.5e8 km; as float32 that is only good
		// to ~10 km. The relative position must not inherit that error.
		const rel = relativePosition(positions, moon, earth)
		const local = propagate(moonOrbit, jd)
		expect(Math.abs(rel[0] - toUnits(local.x))).toBeLessThan(1e-6) // 1e-6 units = 1 m
		expect(Math.abs(rel[2] - toUnits(local.z))).toBeLessThan(1e-6)
	})

	it("supports an arbitrary origin for the fly-to blend", () => {
		const originKm = new Float64Array([
			(positions[3] + positions[6]) / 2,
			(positions[4] + positions[7]) / 2,
			(positions[5] + positions[8]) / 2,
		])
		const e = relativeToOrigin(positions, earth, originKm)
		const m = relativeToOrigin(positions, moon, originKm)
		// origin is the midpoint, so Earth and Moon are mirror images
		expect(e[0]).toBeCloseTo(-m[0], 9)
		expect(e[1]).toBeCloseTo(-m[1], 9)
		expect(e[2]).toBeCloseTo(-m[2], 9)
		const target = [0, 0, 0]
		expect(relativeToOrigin(positions, sun, [0, 0, 0], target)).toBe(target)
		expect(target).toEqual([0, 0, 0])
	})
})

// --- The real data set (src/data/bodies.json) --------------------------------

describe("real bodies from @/data at J2000", () => {
	// Body[] is accepted as is: Body["orbit"] satisfies OrbitElements structurally.
	const index = buildIndex(realBodies)
	const positions = computePositions(realBodies, J2000_JD, undefined, index)

	const indexOf = (id: string): number => {
		const i = index.get(id)
		if (i === undefined) throw new Error(`no body "${id}"`)
		return i
	}
	const distanceKm = (id: string, otherId: string): number => {
		const a = indexOf(id) * 3
		const b = indexOf(otherId) * 3
		return Math.hypot(
			positions[a] - positions[b],
			positions[a + 1] - positions[b + 1],
			positions[a + 2] - positions[b + 2],
		)
	}

	it("yields a finite coordinate for every body", () => {
		expect(realBodies.length).toBeGreaterThan(100)
		expect(positions.length).toBe(realBodies.length * 3)
		for (let i = 0; i < positions.length; i++) {
			expect(
				Number.isFinite(positions[i]),
				realBodies[Math.floor(i / 3)].id,
			).toBe(true)
		}
	})

	it("puts the Sun at the origin and the Earth about 1 AU away", () => {
		expect(Array.from(positions.subarray(0, 3))).toEqual([0, 0, 0])
		const au = distanceKm("earth", "sun") / AU_KM
		expect(au).toBeGreaterThan(0.98)
		expect(au).toBeLessThan(1.02)
	})

	it("keeps the Moon between 363000 and 406000 km from the Earth", () => {
		const d = distanceKm("moon", "earth")
		expect(d).toBeGreaterThan(363000)
		expect(d).toBeLessThan(406000)
	})

	it("keeps Io within 425000 km of Jupiter", () => {
		expect(distanceKm("io", "jupiter")).toBeLessThan(425000)
		expect(distanceKm("io", "jupiter")).toBeGreaterThan(400000)
	})

	it("keeps every orbiting body between periapsis and apoapsis of its parent", () => {
		for (const body of realBodies) {
			if (body.orbit === null || body.parentId === null) continue
			const { semiMajorAxisKm: a, eccentricity: e } = body.orbit
			const d = distanceKm(body.id, body.parentId)
			expect(d, body.id).toBeGreaterThanOrEqual(a * (1 - e) * (1 - 1e-9))
			expect(d, body.id).toBeLessThanOrEqual(a * (1 + e) * (1 + 1e-9))
		}
	})
})

// --- Bodies with real elements against astronomy-engine ----------------------

const AE_PLANETS: Readonly<Record<string, AeBody>> = {
	mercury: AeBody.Mercury,
	venus: AeBody.Venus,
	earth: AeBody.Earth,
	mars: AeBody.Mars,
	jupiter: AeBody.Jupiter,
	saturn: AeBody.Saturn,
	uranus: AeBody.Uranus,
	neptune: AeBody.Neptune,
}

describe("real elements from @/data against astronomy-engine", () => {
	const eqjToEcl = Rotation_EQJ_ECL()
	const index = buildIndex(realBodies)

	/** Parent-centric km, scene frame, from an astronomy-engine EQJ state (AU). */
	const referenceKm = (state: StateVector): Vec3 => {
		const ecl = RotateState(eqjToEcl, state)
		return eclipticToScene({
			x: ecl.x * AU_KM,
			y: ecl.y * AU_KM,
			z: ecl.z * AU_KM,
		})
	}
	const parentCentricKm = (positions: Float64Array, id: string): Vec3 => {
		const body = getBody(id)
		const i = (index.get(id) ?? -1) * 3
		const p = (index.get(body.parentId ?? "") ?? -1) * 3
		return {
			x: positions[i] - positions[p],
			y: positions[i + 1] - positions[p + 1],
			z: positions[i + 2] - positions[p + 2],
		}
	}

	it.each(Object.keys(AE_PLANETS))(
		"%s (bodies.json elements) stays within 0.3 deg and 0.3 % of the ephemeris at J2000, +1000 d, -2000 d",
		(id) => {
			for (const days of [0, 1000, -2000]) {
				const jd = J2000_JD + days
				const positions = computePositions(realBodies, jd, undefined, index)
				const actual = parentCentricKm(positions, id)
				const reference = eclipticToScene(
					ephemerisEclipticKm(AE_PLANETS[id], jd),
				)
				expect(
					separationDeg(actual, reference),
					`${id} at J2000${days >= 0 ? "+" : ""}${days} d`,
				).toBeLessThan(0.3)
				expect(
					Math.abs(length(actual) / length(reference) - 1),
					`${id} at J2000${days >= 0 ? "+" : ""}${days} d`,
				).toBeLessThan(0.003)
			}
		},
	)

	it("the Moon (mean J2000 elements) stays within 3 deg of the true Moon for months", () => {
		for (const days of [0, 30, 100]) {
			const jd = J2000_JD + days
			const positions = computePositions(realBodies, jd, undefined, index)
			const reference = referenceKm(GeoMoonState(MakeTime(jdToDate(jd))))
			const actual = parentCentricKm(positions, "moon")
			expect(separationDeg(actual, reference), `${days} d`).toBeLessThan(3)
			const ratio =
				Math.hypot(actual.x, actual.y, actual.z) /
				Math.hypot(reference.x, reference.y, reference.z)
			expect(ratio, `${days} d`).toBeGreaterThan(0.9)
			expect(ratio, `${days} d`).toBeLessThan(1.1)
		}
	})

	it("the Galilean moons stay within 1.5 deg of astronomy-engine for years", () => {
		for (const days of [0, 100, 365, 1000]) {
			const jd = J2000_JD + days
			const positions = computePositions(realBodies, jd, undefined, index)
			const jupiterMoons = JupiterMoons(MakeTime(jdToDate(jd)))
			for (const id of ["io", "europa", "ganymede", "callisto"] as const) {
				const reference = referenceKm(jupiterMoons[id])
				const actual = parentCentricKm(positions, id)
				expect(
					separationDeg(actual, reference),
					`${id} ${days} d`,
				).toBeLessThan(1.5)
			}
		}
	})

	it("only those five moons (and Phoebe, from JPL's mean elements, #17) carry real phases", () => {
		const real = realBodies.filter(
			(body) => body.kind === "moon" && !body.orbit?.phaseSynthetic,
		)
		expect(real.map((body) => body.id).sort()).toEqual([
			"callisto",
			"europa",
			"ganymede",
			"io",
			"moon",
			"phoebe",
		])
	})
})
