/** The comets' orbit lines (#23): sampled by true anomaly, so the turn round the Sun stays round. */
import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"
import { TWO_PI, propagate, radToDeg, type Vec3 } from "@/sim"

import {
	ORBIT_SEGMENTS,
	TRUE_ANOMALY_SAMPLING_E,
	anchorSlot,
	eccentricAnomalyAt,
	eccentricFromTrueAnomaly,
	sampleOrbit,
} from "../bodies/OrbitLine"
import { isOrbitDrawn } from "../bodies/OrbitLines"

const angle = (a: ArrayLike<number>, i: number, j: number): number => {
	const ax = a[i * 3]
	const ay = a[i * 3 + 1]
	const az = a[i * 3 + 2]
	const bx = a[j * 3]
	const by = a[j * 3 + 1]
	const bz = a[j * 3 + 2]
	const dot = ax * bx + ay * by + az * bz
	return radToDeg(
		Math.acos(
			Math.min(1, dot / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz))),
		),
	)
}

describe("orbit lines of very elongated orbits", () => {
	it("never turn more than one step round the Sun between two samples", () => {
		for (const id of ["halley", "halebopp", "neowise"]) {
			const orbit = getBody(id).orbit!
			expect(orbit.eccentricity).toBeGreaterThanOrEqual(TRUE_ANOMALY_SAMPLING_E)
			const samples = sampleOrbit(orbit)
			for (let k = 0; k < ORBIT_SEGMENTS; k++) {
				expect(angle(samples, k, k + 1), `${id} ${k}`).toBeLessThan(
					360 / ORBIT_SEGMENTS + 1e-6,
				)
			}
			// sample 0 is the perihelion itself
			const q = orbit.semiMajorAxisKm * (1 - orbit.eccentricity)
			expect(Math.hypot(samples[0], samples[1], samples[2]) / q).toBeCloseTo(
				1,
				9,
			)
		}
	})

	it("insert the comet between the two samples around it", () => {
		const orbit = getBody("neowise").orbit!
		const samples = sampleOrbit(orbit)
		for (const jd of [2459000, 2459034.18, 2459100, 2460000]) {
			const slot = anchorSlot(eccentricAnomalyAt(orbit, jd), orbit.eccentricity)
			const at: Vec3 = { x: 0, y: 0, z: 0 }
			propagate(orbit, jd, at)
			const here = [at.x, at.y, at.z]
			const all = [...samples, ...here]
			const n = samples.length / 3
			// the comet lies within the angle between its two samples
			const total = angle(all, slot, slot + 1)
			expect(angle(all, slot, n) + angle(all, n, slot + 1)).toBeCloseTo(
				total,
				6,
			)
		}
	})

	it("keep uniform eccentric anomalies below the threshold (every existing orbit unchanged)", () => {
		for (const body of bodies) {
			if (body.orbit === null) continue
			if (body.orbit.eccentricity >= TRUE_ANOMALY_SAMPLING_E) {
				expect(body.kind, body.id).toBe("comet")
			}
		}
		expect(anchorSlot(Math.PI)).toBe(ORBIT_SEGMENTS / 2)
		expect(eccentricFromTrueAnomaly(0, 0.99)).toBe(0)
		expect(eccentricFromTrueAnomaly(Math.PI, 0.99)).toBeCloseTo(Math.PI, 9)
		expect(eccentricFromTrueAnomaly(1, 0)).toBeCloseTo(1, 12)
		expect(eccentricFromTrueAnomaly(-1, 0.5)).toBeLessThan(TWO_PI)
	})

	it("draw an asteroid's orbit only while it is focused or selected", () => {
		const vesta = getBody("vesta")
		expect(isOrbitDrawn(vesta, "sun", null)).toBe(false)
		expect(isOrbitDrawn(vesta, "vesta", null)).toBe(true)
		expect(isOrbitDrawn(vesta, "sun", "vesta")).toBe(true)
		expect(isOrbitDrawn(getBody("pluto"), "sun", null)).toBe(true)
		expect(isOrbitDrawn(getBody("halley"), "sun", null)).toBe(true)
	})
})
