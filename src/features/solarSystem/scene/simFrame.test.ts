import { describe, expect, it } from "vitest"
import { Vector3 } from "three"

import { bodies, getBody } from "@/data"
import { J2000_JD, SCALE_PRESETS, TRUE_SCALE, toUnits } from "@/sim"

import { createSimFrame, setSimFrameScale, updateSimFrame } from "./simFrame"

const index = (id: string): number => bodies.findIndex((b) => b.id === id)

describe("createSimFrame", () => {
	it("holds every body with positions computed at the given time", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		expect(frame.bodies).toBe(bodies)
		// true scale is the engine's baseline: without a scale, what is drawn is the truth
		expect(frame.scale).toBe(TRUE_SCALE)
		expect(frame.displayKm.length).toBe(bodies.length * 3)
		expect(frame.displayRadiiKm[index("earth")]).toBe(getBody("earth").radiusKm)
		expect(frame.index.size).toBe(bodies.length)
		expect(frame.positionsKm.length).toBe(bodies.length * 3)
		expect(frame.jd).toBe(J2000_JD)
		// the Sun sits at the world origin and is the initial render origin
		expect(Array.from(frame.positionsKm.slice(0, 3))).toEqual([0, 0, 0])
		expect(Array.from(frame.originKm)).toEqual([0, 0, 0])
		const earth = index("earth")
		const r = Math.hypot(
			frame.positionsKm[earth * 3],
			frame.positionsKm[earth * 3 + 1],
			frame.positionsKm[earth * 3 + 2],
		)
		expect(r).toBeGreaterThan(1.45e8)
		expect(r).toBeLessThan(1.53e8)
	})

	it("renders positions relative to the origin in scene units", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const out = new Vector3()
		const earth = index("earth")
		expect(frame.renderPosition(earth, out)).toBe(out)
		expect(out.x).toBeCloseTo(toUnits(frame.positionsKm[earth * 3]), 9)
		expect(out.z).toBeCloseTo(toUnits(frame.positionsKm[earth * 3 + 2]), 9)
		const byId = frame.renderPositionOf("earth", new Vector3())
		expect(byId.equals(out)).toBe(true)
		expect(() => frame.renderPositionOf("vulcan", out)).toThrow(/vulcan/)
	})
})

describe("updateSimFrame", () => {
	it("moves time and puts the focus body exactly at the render origin", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const io = index("io")
		updateSimFrame(frame, J2000_JD + 100, io)
		expect(frame.jd).toBe(J2000_JD + 100)
		const out = new Vector3()
		frame.renderPosition(io, out)
		expect(out.x).toBe(0)
		expect(out.y).toBe(0)
		expect(out.z).toBe(0)
		// Jupiter is one Io orbit radius away, in doubles, no float32 loss
		const jupiter = index("jupiter")
		frame.renderPosition(jupiter, out)
		const a = getBody("io").orbit?.semiMajorAxisKm ?? 0
		expect(out.length()).toBeGreaterThan(toUnits(a * 0.99))
		expect(out.length()).toBeLessThan(toUnits(a * 1.01))
	})

	it("draws display positions under the frame's scale and puts the focus's display position at the origin", () => {
		const frame = createSimFrame(
			bodies,
			J2000_JD,
			SCALE_PRESETS.everythingVisible,
		)
		const earth = index("earth")
		updateSimFrame(frame, J2000_JD + 10, earth)
		expect(Array.from(frame.originKm)).toEqual(
			Array.from(frame.displayKm.slice(earth * 3, earth * 3 + 3)),
		)
		// the true positions stay true: Earth is still ~1 AU from the Sun there
		const trueDistance = Math.hypot(
			...Array.from(frame.positionsKm.slice(earth * 3, earth * 3 + 3)),
		)
		expect(trueDistance).toBeGreaterThan(1.45e8)
		// but it is drawn much closer, and 10x bigger
		const out = frame.renderPosition(0, new Vector3())
		expect(out.length()).toBeLessThan(toUnits(trueDistance) / 5)
		expect(frame.renderRadius(earth)).toBeGreaterThan(
			10 * toUnits(bodies[earth].radiusKm),
		)
	})

	it("switches scale at runtime: radii and positions follow at once, the version moves on", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const saturn = index("saturn")
		const titan = index("titan")
		updateSimFrame(frame, J2000_JD, saturn)
		const trueRadius = frame.displayRadiiKm[saturn]
		expect(trueRadius).toBe(bodies[saturn].radiusKm)
		const version = frame.scaleVersion

		setSimFrameScale(frame, SCALE_PRESETS.everythingVisible)
		expect(frame.scaleVersion).toBe(version + 1)
		expect(frame.displayRadiiKm[saturn]).toBeGreaterThan(3 * trueRadius)
		// Titan moved in along its true direction, before any clock tick
		updateSimFrame(frame, J2000_JD, saturn)
		const titanOut = frame.renderPosition(titan, new Vector3())
		const titanTrue = new Vector3(
			...Array.from(frame.positionsKm.slice(titan * 3, titan * 3 + 3)),
		).sub(
			new Vector3(
				...Array.from(frame.positionsKm.slice(saturn * 3, saturn * 3 + 3)),
			),
		)
		expect(titanOut.clone().normalize().dot(titanTrue.normalize())).toBeCloseTo(
			1,
			9,
		)

		// setting the same scale again changes nothing
		setSimFrameScale(frame, SCALE_PRESETS.everythingVisible)
		expect(frame.scaleVersion).toBe(version + 1)
		setSimFrameScale(frame, TRUE_SCALE)
		expect(frame.displayRadiiKm[saturn]).toBe(trueRadius)
	})

	it("reuses the same typed arrays every tick", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const positions = frame.positionsKm
		const origin = frame.originKm
		updateSimFrame(frame, J2000_JD + 1, 3)
		updateSimFrame(frame, J2000_JD + 2, 4)
		expect(frame.positionsKm).toBe(positions)
		expect(frame.originKm).toBe(origin)
	})
})
