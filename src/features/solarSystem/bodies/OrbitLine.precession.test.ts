import { describe, expect, it } from "vitest"

import { getBody } from "@/data"
import { J2000_JD, orbitAt, propagate } from "@/sim"

import {
	ORBIT_RESAMPLE_DEG,
	createOrbitBuffers,
	sampleOrbit,
	syncOrbitPrecession,
} from "./OrbitLine"

const moon = getBody("moon")
const orbit = moon.orbit
if (orbit === null || orbit.precession === undefined) {
	throw new Error("the Moon's orbit precesses")
}

/** Distance (km) from `p` to the nearest sample of the line. */
const nearestSample = (
	samples: Float64Array,
	p: { x: number; y: number; z: number },
): number => {
	let best = Infinity
	for (let s = 0; s < samples.length; s += 3) {
		best = Math.min(
			best,
			Math.hypot(samples[s] - p.x, samples[s + 1] - p.y, samples[s + 2] - p.z),
		)
	}
	return best
}

describe("orbit lines of a precessing orbit (the Moon)", () => {
	it("resample once the orbit has turned, so the line stays under the Moon for decades", () => {
		const buffers = createOrbitBuffers(orbit, J2000_JD)
		const jd = J2000_JD + 9000 // 2024: the perigee has turned 1479 deg, the node 477
		const here = propagate(orbit, jd)
		// the J2000 ellipse is far from where the Moon is now
		expect(nearestSample(buffers.samples, here)).toBeGreaterThan(10_000)

		expect(syncOrbitPrecession(buffers, orbit, jd)).toBe(true)
		expect(buffers.sampledAtJD).toBe(jd)
		expect(buffers.scaleVersion).toBe(-1) // the display samples are re-mapped next
		expect(Array.from(buffers.samples)).toEqual(
			Array.from(sampleOrbit(orbitAt(orbit, jd))),
		)
		// 256 samples of a 384,400 km orbit are 9,400 km apart: the Moon sits between two
		expect(nearestSample(buffers.samples, here)).toBeLessThan(5_000)
	})

	it("does not resample for less than ORBIT_RESAMPLE_DEG of turn, nor ever for a fixed orbit", () => {
		const buffers = createOrbitBuffers(orbit, J2000_JD)
		const rate =
			Math.abs(orbit.precession?.nodeDegPerDay ?? 0) +
			Math.abs(orbit.precession?.argPeriapsisDegPerDay ?? 0)
		const justUnder = (0.9 * ORBIT_RESAMPLE_DEG) / rate
		expect(syncOrbitPrecession(buffers, orbit, J2000_JD + justUnder)).toBe(
			false,
		)
		expect(syncOrbitPrecession(buffers, orbit, J2000_JD - 2 * justUnder)).toBe(
			true,
		)

		const earth = getBody("earth").orbit
		if (earth === null) throw new Error("earth has an orbit")
		const fixed = createOrbitBuffers(earth, J2000_JD)
		expect(syncOrbitPrecession(fixed, earth, J2000_JD + 1e5)).toBe(false)
	})
})
