import { describe, expect, it } from "vitest"
import { Vector3 } from "three"

import { getBody } from "@/data"
import { equatorNode, spinAxis } from "@/sim"

import { bodyOrientation } from "./orientation"

const expectVec = (actual: Vector3, expected: Vector3, digits = 9): void => {
	expect(actual.x).toBeCloseTo(expected.x, digits)
	expect(actual.y).toBeCloseTo(expected.y, digits)
	expect(actual.z).toBeCloseTo(expected.z, digits)
}

describe("bodyOrientation", () => {
	for (const id of ["earth", "uranus", "venus", "moon", "io", "phobos"]) {
		it(`maps local +Y to the spin axis and +X to the equator node for ${id}`, () => {
			const body = getBody(id)
			const q = bodyOrientation(body)
			const axis = new Vector3()
			const node = new Vector3()
			spinAxis(body.rotation, body.orbit, axis)
			equatorNode(body.rotation, body.orbit, node)
			expectVec(new Vector3(0, 1, 0).applyQuaternion(q), axis)
			expectVec(new Vector3(1, 0, 0).applyQuaternion(q), node)
			expect(q.length()).toBeCloseTo(1, 12)
		})
	}

	it("keeps Earth's pole 23.44 deg from the ecliptic pole, leaning toward -Z", () => {
		const up = new Vector3(0, 1, 0).applyQuaternion(
			bodyOrientation(getBody("earth")),
		)
		expect((Math.acos(up.y) * 180) / Math.PI).toBeCloseTo(23.4393, 3)
		expect(up.z).toBeLessThan(0)
		expect(Math.abs(up.x)).toBeLessThan(1e-6)
	})

	it("lays Uranus's IAU north pole 82 deg from the ecliptic pole, just north", () => {
		// the data keeps the tilt to the IAU north pole (180 - 97.77) and marks the
		// retrograde spin with the negative period, so north-up maps stay upright
		const up = new Vector3(0, 1, 0).applyQuaternion(
			bodyOrientation(getBody("uranus")),
		)
		expect((Math.acos(up.y) * 180) / Math.PI).toBeGreaterThan(80)
		expect((Math.acos(up.y) * 180) / Math.PI).toBeLessThan(85)
		expect(up.y).toBeGreaterThan(0)
		expect(getBody("uranus").rotation.periodHours).toBeLessThan(0)
	})

	it("reuses the given quaternion", () => {
		const body = getBody("mars")
		const q = bodyOrientation(body)
		expect(bodyOrientation(body, q)).toBe(q)
	})
})
