import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { occluderCandidates, rootIndexOf } from "@/sim"

import { createSimFrame, updateSimFrame } from "../scene/simFrame"
import { createSunlightUniforms, updateSunlight } from "./bodyLighting"

const sun = rootIndexOf(bodies)
const indexOf = (id: string) => bodies.findIndex((body) => body.id === id)

describe("updateSunlight", () => {
	it("points at the true Sun, whatever the scale draws", () => {
		const frame = createSimFrame(bodies, 2461122.5)
		const earth = indexOf("earth")
		const uniforms = createSunlightUniforms(bodies[earth], bodies[sun].radiusKm)
		updateSunlight(uniforms, frame, earth, sun, [], () => true, false)
		const p = frame.positionsKm
		const e = earth * 3
		expect(uniforms.uSunKm.value.x).toBeCloseTo(-p[e], -1)
		expect(uniforms.uSunKm.value.z).toBeCloseTo(-p[e + 2], -1)
		expect(uniforms.uSunKm.value.length() / 149.6e6).toBeCloseTo(1, 1)
		expect(uniforms.uBodyRadiusKm.value).toBe(bodies[earth].radiusKm)
		expect(uniforms.uAlwaysLit.value).toBe(0)
	})

	it("hands Io's shadow to Jupiter during a transit, drops hidden casters, and none when always lit", () => {
		const frame = createSimFrame(bodies, 2461122.5)
		const jupiter = indexOf("jupiter")
		const io = indexOf("io")
		const casters = occluderCandidates(bodies, jupiter)
		const uniforms = createSunlightUniforms(
			bodies[jupiter],
			bodies[sun].radiusKm,
		)
		// find a moment within one orbit of Io when it is a caster
		let found = false
		for (let t = 0; t < 1.8 && !found; t += 0.01) {
			updateSimFrame(frame, 2461122.5 + t, sun)
			updateSunlight(uniforms, frame, jupiter, sun, [io], () => true, false)
			found = uniforms.uOccluderCount.value === 1
		}
		expect(found).toBe(true)
		expect(uniforms.uOccluders.value[3]).toBeCloseTo(bodies[io].radiusKm, 1)

		updateSunlight(
			uniforms,
			frame,
			jupiter,
			sun,
			casters,
			(j) => j !== io,
			false,
		)
		for (let k = 0; k < uniforms.uOccluderCount.value; k++) {
			expect(uniforms.uOccluders.value[k * 4 + 3]).not.toBeCloseTo(
				bodies[io].radiusKm,
				1,
			)
		}

		updateSunlight(uniforms, frame, jupiter, sun, casters, () => true, true)
		expect(uniforms.uOccluderCount.value).toBe(0)
		expect(uniforms.uAlwaysLit.value).toBe(1)
	})
})
