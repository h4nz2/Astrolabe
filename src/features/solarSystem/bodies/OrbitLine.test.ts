import { describe, expect, it } from "vitest"
import { Vector3 } from "three"

import { bodies, getBody, planets } from "@/data"
import { J2000_JD, TWO_PI, propagate, toUnits, type OrbitElements } from "@/sim"

import { createSimFrame, updateSimFrame } from "../scene/simFrame"
import {
	ORBIT_POINTS,
	ORBIT_REBUILD_FRACTION,
	ORBIT_SAMPLES,
	ORBIT_SEGMENTS,
	anchorSlot,
	anchorVertex,
	createOrbitBuffers,
	eccentricAnomalyAt,
	sampleOrbit,
	updateOrbitBuffers,
} from "./OrbitLine"

const orbit: OrbitElements = {
	semiMajorAxisKm: 1e6,
	eccentricity: 0.5,
	inclinationDeg: 0,
	longAscNodeDeg: 0,
	argPeriapsisDeg: 0,
	meanAnomalyDeg: 0,
	periodDays: 10,
	epochJD: J2000_JD,
}

const STEP = TWO_PI / ORBIT_SEGMENTS

/** A two-body frame: parent at index 0, child at 1. */
const frameWith = (
	parentKm: number[],
	originKm: number[],
	childKm: number[] = [0, 0, 0],
	jd = J2000_JD,
) => ({
	positionsKm: new Float64Array([...parentKm, ...childKm]),
	originKm: new Float64Array(originKm),
	jd,
})

const vertex = (positions: Float32Array, v: number): number[] =>
	Array.from(positions.slice(v * 3, v * 3 + 3))

describe("sampleOrbit", () => {
	it("returns 257 closed points starting at periapsis", () => {
		const samples = sampleOrbit(orbit)
		expect(samples.length).toBe(ORBIT_SAMPLES * 3)
		expect(ORBIT_POINTS).toBe(ORBIT_SAMPLES + 1)
		expect(samples[0]).toBeCloseTo(1e6 * (1 - 0.5), 6)
		expect(samples[1]).toBeCloseTo(0, 6)
		expect(samples[2]).toBeCloseTo(0, 6)
		const last = (ORBIT_SAMPLES - 1) * 3
		expect(samples[last]).toBe(samples[0])
		expect(samples[last + 1]).toBe(samples[1])
		expect(samples[last + 2]).toBe(samples[2])
		// apoapsis half way round
		const half = (ORBIT_SAMPLES - 1) / 2
		expect(samples[half * 3]).toBeCloseTo(-1e6 * (1 + 0.5), 6)
	})

	it("stays in the ecliptic (scene XZ) plane for an uninclined orbit", () => {
		const samples = sampleOrbit(getBody("earth").orbit ?? orbit)
		for (let k = 0; k < ORBIT_SAMPLES; k++) {
			expect(Math.abs(samples[k * 3 + 1])).toBeLessThan(1e5)
		}
	})
})

describe("anchorSlot", () => {
	it("maps an eccentric anomaly to the sample interval holding it", () => {
		expect(anchorSlot(0)).toBe(0)
		expect(anchorSlot(STEP * 0.999)).toBe(0)
		expect(anchorSlot(STEP)).toBe(1)
		expect(anchorSlot(Math.PI)).toBe(ORBIT_SEGMENTS / 2)
		// a full turn (and Newton overshoot) stays inside the last interval
		expect(anchorSlot(TWO_PI)).toBe(ORBIT_SEGMENTS - 1)
		expect(anchorSlot(TWO_PI + 1e-9)).toBe(ORBIT_SEGMENTS - 1)
		expect(anchorSlot(-1e-9)).toBe(0)
		expect(anchorVertex(0)).toBe(1)
		expect(anchorVertex(ORBIT_SEGMENTS - 1)).toBe(ORBIT_SEGMENTS)
	})
})

describe("updateOrbitBuffers", () => {
	it("rebuilds on first use relative to the origin and parent", () => {
		const buffers = createOrbitBuffers(orbit)
		const shift = { x: 1, y: 1, z: 1 }
		const rebuilt = updateOrbitBuffers(
			buffers,
			orbit,
			frameWith([100, 0, 0], [50, 0, 0]),
			1,
			0,
			shift,
		)
		expect(rebuilt).toBe(true)
		expect(buffers.built).toBe(true)
		expect(shift).toEqual({ x: 0, y: 0, z: 0 })
		expect(buffers.positions[0]).toBeCloseTo(toUnits(5e5 + 100 - 50), 3)
		expect(Array.from(buffers.originAtRebuild)).toEqual([50, 0, 0])
		expect(Array.from(buffers.parentAtRebuild)).toEqual([100, 0, 0])
	})

	it("nudges instead of rebuilding for small moves, with the exact delta", () => {
		const buffers = createOrbitBuffers(orbit)
		const shift = { x: 0, y: 0, z: 0 }
		updateOrbitBuffers(
			buffers,
			orbit,
			frameWith([0, 0, 0], [0, 0, 0]),
			1,
			0,
			shift,
		)
		const positionsBefore = Float32Array.from(buffers.positions)
		const small = ORBIT_REBUILD_FRACTION * orbit.semiMajorAxisKm * 0.5
		// origin moved +small in x, parent moved +2 small in z
		const rebuilt = updateOrbitBuffers(
			buffers,
			orbit,
			frameWith([0, 0, 2 * small], [small, 0, 0]),
			1,
			0,
			shift,
		)
		expect(rebuilt).toBe(false)
		// only the anchor vertex may change between rebuilds
		const anchor = anchorVertex(buffers.slot)
		for (let v = 0; v < ORBIT_POINTS; v++) {
			if (v === anchor) continue
			expect(vertex(buffers.positions, v)).toEqual(vertex(positionsBefore, v))
		}
		expect(shift.x).toBeCloseTo(toUnits(-small), 9)
		expect(shift.y).toBe(0)
		expect(shift.z).toBeCloseTo(toUnits(2 * small), 9)
	})

	it("rebuilds once the origin or the parent moved past the threshold", () => {
		const buffers = createOrbitBuffers(orbit)
		const shift = { x: 0, y: 0, z: 0 }
		updateOrbitBuffers(
			buffers,
			orbit,
			frameWith([0, 0, 0], [0, 0, 0]),
			1,
			0,
			shift,
		)
		const big = ORBIT_REBUILD_FRACTION * orbit.semiMajorAxisKm * 1.5
		expect(
			updateOrbitBuffers(
				buffers,
				orbit,
				frameWith([0, 0, 0], [big, 0, 0]),
				1,
				0,
				shift,
			),
		).toBe(true)
		expect(Array.from(buffers.originAtRebuild)).toEqual([big, 0, 0])
		expect(
			updateOrbitBuffers(
				buffers,
				orbit,
				frameWith([0, big, 0], [big, 0, 0]),
				1,
				0,
				shift,
			),
		).toBe(true)
		expect(Array.from(buffers.parentAtRebuild)).toEqual([0, big, 0])
		expect(buffers.positions[1]).toBeCloseTo(toUnits(big), 3)
	})

	it("needs no rebuild while the parent is the origin (a moon of the focus)", () => {
		const buffers = createOrbitBuffers(orbit)
		const shift = { x: 0, y: 0, z: 0 }
		updateOrbitBuffers(
			buffers,
			orbit,
			frameWith([0, 0, 0], [0, 0, 0]),
			1,
			0,
			shift,
		)
		const far = 1e9
		// parent and origin move together: the deltas cancel, but each alone is over the threshold
		const rebuilt = updateOrbitBuffers(
			buffers,
			orbit,
			frameWith([far, 0, 0], [far, 0, 0]),
			1,
			0,
			shift,
		)
		expect(rebuilt).toBe(true)
		expect(shift).toEqual({ x: 0, y: 0, z: 0 })
	})

	it("inserts the anchor on the body between the two samples bracketing its anomaly", () => {
		const jd = J2000_JD + 1.37
		const child = propagate(orbit, jd)
		const buffers = createOrbitBuffers(orbit)
		const shift = { x: 0, y: 0, z: 0 }
		updateOrbitBuffers(
			buffers,
			orbit,
			frameWith([0, 0, 0], [0, 0, 0], [child.x, child.y, child.z], jd),
			1,
			0,
			shift,
		)
		const E = eccentricAnomalyAt(orbit, jd)
		const slot = anchorSlot(E)
		expect(buffers.slot).toBe(slot)
		expect(E).toBeGreaterThanOrEqual(slot * STEP)
		expect(E).toBeLessThan((slot + 1) * STEP)
		// vertices: samples 0..slot, the body, samples slot+1..256
		const { samples, positions } = buffers
		const sample = (k: number) => [
			toUnits(samples[k * 3]),
			toUnits(samples[k * 3 + 1]),
			toUnits(samples[k * 3 + 2]),
		]
		const close = (a: number[], b: number[]) =>
			a.every((value, i) => Math.abs(value - b[i]) < 1e-3)
		expect(close(vertex(positions, slot), sample(slot))).toBe(true)
		expect(
			close(vertex(positions, anchorVertex(slot)), [
				toUnits(child.x),
				toUnits(child.y),
				toUnits(child.z),
			]),
		).toBe(true)
		expect(close(vertex(positions, slot + 2), sample(slot + 1))).toBe(true)
		expect(close(vertex(positions, ORBIT_POINTS - 1), sample(0))).toBe(true)
	})

	it("re-slots (rebuilds) when the body crosses into the next sample interval", () => {
		const buffers = createOrbitBuffers(orbit)
		const shift = { x: 0, y: 0, z: 0 }
		// M = 0 at the epoch: slot 0
		updateOrbitBuffers(
			buffers,
			orbit,
			frameWith([0, 0, 0], [0, 0, 0]),
			1,
			0,
			shift,
		)
		expect(buffers.slot).toBe(0)
		// still inside the first interval: only the anchor moves
		const inside = J2000_JD + 0.01
		expect(anchorSlot(eccentricAnomalyAt(orbit, inside))).toBe(0)
		expect(
			updateOrbitBuffers(
				buffers,
				orbit,
				frameWith([0, 0, 0], [0, 0, 0], [0, 0, 0], inside),
				1,
				0,
				shift,
			),
		).toBe(false)
		// past the first sample: the anchor changes place, so the vertices are rebuilt
		const beyond = J2000_JD + 0.03
		expect(anchorSlot(eccentricAnomalyAt(orbit, beyond))).toBe(1)
		expect(
			updateOrbitBuffers(
				buffers,
				orbit,
				frameWith([0, 0, 0], [0, 0, 0], [0, 0, 0], beyond),
				1,
				0,
				shift,
			),
		).toBe(true)
		expect(buffers.slot).toBe(1)
	})

	it("keeps every planet's render position on its own orbit line, at rest and between rebuilds", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const render = new Vector3()
		for (const planet of planets) {
			const index = frame.index.get(planet.id)
			const parentIndex = frame.index.get("sun")
			if (
				planet.orbit === null ||
				index === undefined ||
				parentIndex === undefined
			) {
				throw new Error(`no orbit for ${planet.id}`)
			}
			const buffers = createOrbitBuffers(planet.orbit)
			const shift = { x: 0, y: 0, z: 0 }
			for (const [jd, expectRebuild] of [
				[J2000_JD, true],
				// 30 s later: the focus (origin) moved a few km, far below the rebuild threshold
				[J2000_JD + 30 / 86400, false],
				[J2000_JD + 1000, true],
			] as const) {
				// the planet is the focus: its render position is the origin
				updateSimFrame(frame, jd, index)
				const rebuilt = updateOrbitBuffers(
					buffers,
					planet.orbit,
					frame,
					index,
					parentIndex,
					shift,
				)
				expect(rebuilt).toBe(expectRebuild)
				frame.renderPosition(index, render)
				const a = anchorVertex(buffers.slot) * 3
				const { positions } = buffers
				// anchor + line shift = the body's render position, to well under a kilometre
				expect(positions[a] + shift.x - render.x).toBeCloseTo(0, 3)
				expect(positions[a + 1] + shift.y - render.y).toBeCloseTo(0, 3)
				expect(positions[a + 2] + shift.z - render.z).toBeCloseTo(0, 3)
			}
		}
	})
})
