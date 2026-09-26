/**
 * The small bodies (#23) sit where the sky has them: Pluto against astronomy-engine, the
 * others at their JPL perihelion distances, and Pluto's moons on its equator.
 */
import { Body as AeBody } from "astronomy-engine"
import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"

import { propagateEcliptic, type Vec3 } from "./kepler"
import { ephemerisEclipticKm, separationDeg } from "./testing/ephemeris"
import { AU_KM } from "./units"

const at = (id: string, jd: number): Vec3 => {
	const out: Vec3 = { x: 0, y: 0, z: 0 }
	propagateEcliptic(getBody(id).orbit!, jd, out)
	return out
}

describe("small bodies on their real orbits", () => {
	it("puts Pluto within 0.3 deg of astronomy-engine from 2000 to 2050", () => {
		for (let jd = 2451545; jd <= 2469807; jd += 1826) {
			const model = at("pluto", jd)
			const reference = ephemerisEclipticKm(AeBody.Pluto, jd)
			expect(separationDeg(model, reference), `JD ${jd}`).toBeLessThan(0.3)
			const r = Math.hypot(model.x, model.y, model.z)
			const rr = Math.hypot(reference.x, reference.y, reference.z)
			expect(Math.abs(r / rr - 1), `JD ${jd}`).toBeLessThan(0.005)
		}
	})

	it("gives every small body real elements and a sane period", () => {
		const small = bodies.filter((body) =>
			["dwarfPlanet", "asteroid", "comet"].includes(body.kind),
		)
		expect(small.map((body) => body.id).sort()).toEqual(
			[
				"ceres",
				"pluto",
				"haumea",
				"makemake",
				"eris",
				"vesta",
				"pallas",
				"juno",
				"hygiea",
				"eros",
				"bennu",
				"arrokoth",
				"halley",
				"encke",
				"67p",
				"halebopp",
				"neowise",
			].sort(),
		)
		for (const body of small) {
			const orbit = body.orbit!
			expect(orbit.phaseSynthetic, body.id).toBeUndefined()
			expect(body.parentId).toBe("sun")
			// Kepler's third law around the Sun to 3 % (Halley's period is its mean return time)
			const years = orbit.periodDays / 365.25
			const au = orbit.semiMajorAxisKm / AU_KM
			expect(years / au ** 1.5, body.id).toBeGreaterThan(0.97)
			expect(years / au ** 1.5, body.id).toBeLessThan(1.03)
		}
	})

	it("keeps Pluto's moons in one plane, 113 deg to the ecliptic (Pluto lies on its side, spinning backwards)", () => {
		for (const id of ["charon", "styx", "nix", "kerberos", "hydra"]) {
			const orbit = getBody(id).orbit!
			expect(orbit.inclinationDeg, id).toBeGreaterThan(112)
			expect(orbit.inclinationDeg, id).toBeLessThan(114)
			expect(orbit.longAscNodeDeg, id).toBeCloseTo(227.4, 0)
		}
		expect(getBody("pluto").rotation.periodHours).toBeLessThan(0)
		expect(getBody("charon").rotation.synchronous).toBe(true)
	})

	it("sends the comets out on wildly elongated orbits", () => {
		for (const [id, q, e] of [
			["halley", 0.575, 0.968],
			["encke", 0.339, 0.847],
			["halebopp", 0.89, 0.995],
			["neowise", 0.295, 0.999],
		] as const) {
			const orbit = getBody(id).orbit!
			expect(orbit.eccentricity, id).toBeCloseTo(e, 3)
			expect(
				(orbit.semiMajorAxisKm * (1 - orbit.eccentricity)) / AU_KM,
				id,
			).toBeCloseTo(q, 2)
			expect(getBody(id).tail, id).toBeDefined()
		}
		// Halley goes round backwards
		expect(getBody("halley").orbit!.inclinationDeg).toBeGreaterThan(90)
	})
})
