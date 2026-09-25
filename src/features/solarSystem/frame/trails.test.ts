import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import {
	KM_PER_UNIT,
	SCALE_PRESETS,
	buildIndex,
	computePositions,
	dateToJD,
	type ScaleSettings,
} from "@/sim"
import { framedOffset, topLevelIndices } from "@/sim/referenceFrame"

import {
	TRAIL_CAPACITY,
	TRAIL_LENGTH_DAYS,
	TRAIL_STEP_DAYS,
	TRAIL_VERTICES,
	createTrailBuffers,
	trailAlpha,
	trailBodies,
	trailWindow,
	updateTrails,
	type TrailFrame,
} from "./trails"

const index = buildIndex(bodies)
const topIndex = topLevelIndices(bodies, index)
const at = (id: string) => index.get(id)!
const EV = SCALE_PRESETS.everythingVisible

const frameAt = (
	jd: number,
	scale: ScaleSettings = EV,
	scaleVersion = 0,
): TrailFrame => ({
	bodies,
	index,
	topIndex,
	positionsKm: computePositions(bodies, jd, undefined, index),
	scale,
	scaleVersion,
	jd,
})

const trailOf = (
	buffers: ReturnType<typeof createTrailBuffers>,
	id: string,
) => {
	const t = Array.from(buffers.bodies).indexOf(at(id))
	const out: number[][] = []
	for (let k = 0; k < buffers.vertexCount; k++) {
		const v = (t * TRAIL_VERTICES + k) * 3
		out.push([
			buffers.positions[v],
			buffers.positions[v + 1],
			buffers.positions[v + 2],
		])
	}
	return out
}

describe("trailWindow", () => {
	it("is the last two years by default", () => {
		expect(trailWindow(1000, null)).toEqual([1000 - TRAIL_LENGTH_DAYS, 1000])
	})

	it("grows from a restart, and covers the span back to it when time runs backwards", () => {
		expect(trailWindow(1010, 1000)).toEqual([1000, 1010])
		expect(trailWindow(5000, 1000)).toEqual([5000 - TRAIL_LENGTH_DAYS, 5000])
		expect(trailWindow(990, 1000)).toEqual([990, 1000])
		expect(trailWindow(1000, 1000)).toEqual([1000, 1000])
	})
})

describe("updateTrails", () => {
	const earth = at("earth")

	it("draws nothing in the Sun-centred frame", () => {
		const buffers = createTrailBuffers(trailBodies({ topIndex }))
		updateTrails(buffers, frameAt(2460000.5), -1, null)
		expect(buffers.vertexCount).toBe(0)
	})

	it("holds two years of daily samples and ends on the body itself", () => {
		const buffers = createTrailBuffers(trailBodies({ topIndex }))
		const jd = 2460000.25
		const frame = frameAt(jd)
		updateTrails(buffers, frame, earth, null)
		// the grid is whole Julian days (noon UTC): 730 or 731 fit in two years
		expect(buffers.count).toBeGreaterThanOrEqual(TRAIL_CAPACITY - 1)
		expect(buffers.count).toBeLessThanOrEqual(TRAIL_CAPACITY)
		expect(buffers.vertexCount).toBe(buffers.count + 1)
		const mars = trailOf(buffers, "mars")
		const head = mars[mars.length - 1]
		const p = frame.positionsKm
		const m = at("mars") * 3
		const e = earth * 3
		const out = new Float64Array(3)
		framedOffset(
			p[m] - p[e],
			p[m + 1] - p[e + 1],
			p[m + 2] - p[e + 2],
			bodies[at("sun")].radiusKm,
			EV,
			out,
		)
		head.forEach((v, k) => expect(v).toBeCloseTo(out[k] / KM_PER_UNIT, 0))
	})

	it("slides day by day to exactly what a fresh computation gives", () => {
		const slid = createTrailBuffers(trailBodies({ topIndex }))
		let jd = 2460100.5
		updateTrails(slid, frameAt(jd), earth, null)
		for (let k = 0; k < 40; k++) {
			jd += 0.37 * TRAIL_STEP_DAYS
			updateTrails(slid, frameAt(jd), earth, null)
		}
		const fresh = createTrailBuffers(trailBodies({ topIndex }))
		updateTrails(fresh, frameAt(jd), earth, null)
		expect(slid.first).toBe(fresh.first)
		expect(Array.from(slid.positions)).toEqual(Array.from(fresh.positions))
	})

	it("rescales when the scale changes and re-anchors when the frame does", () => {
		const buffers = createTrailBuffers(trailBodies({ topIndex }))
		const jd = 2460100.5
		updateTrails(buffers, frameAt(jd), earth, null)
		const before = trailOf(buffers, "jupiter")[10]
		updateTrails(buffers, frameAt(jd, SCALE_PRESETS.trueScale, 1), earth, null)
		const after = trailOf(buffers, "jupiter")[10]
		expect(Math.hypot(...after)).toBeGreaterThan(5 * Math.hypot(...before))
		updateTrails(
			buffers,
			frameAt(jd, SCALE_PRESETS.trueScale, 1),
			at("mars"),
			null,
		)
		expect(buffers.anchor).toBe(at("mars"))
		expect(trailOf(buffers, "earth").length).toBe(buffers.vertexCount)
	})

	it("draws Mars's retrograde loop around Earth (winter 2024/25)", () => {
		const buffers = createTrailBuffers(trailBodies({ topIndex }))
		const jd = dateToJD(new Date("2025-06-01T00:00Z"))
		updateTrails(buffers, frameAt(jd), earth, null)
		const mars = trailOf(buffers, "mars")
		// the direction from Earth, seen from ecliptic north: angle of (x, -z)
		const angle = (v: number[]) => Math.atan2(-v[2], v[0])
		const dayIndex = (iso: string) =>
			Math.round(dateToJD(new Date(iso)) - buffers.first * TRAIL_STEP_DAYS)
		const turn = (from: string, to: string) => {
			let d = angle(mars[dayIndex(to)]) - angle(mars[dayIndex(from)])
			if (d > Math.PI) d -= 2 * Math.PI
			if (d < -Math.PI) d += 2 * Math.PI
			return d
		}
		expect(turn("2024-10-01T00:00Z", "2024-11-15T00:00Z")).toBeGreaterThan(0)
		expect(turn("2024-12-20T00:00Z", "2025-02-10T00:00Z")).toBeLessThan(0)
		expect(turn("2025-03-15T00:00Z", "2025-05-01T00:00Z")).toBeGreaterThan(0)
	})

	it("grows from a restart", () => {
		const buffers = createTrailBuffers(trailBodies({ topIndex }))
		// grid days 2460001..2460010 (whole Julian days), then the head
		updateTrails(buffers, frameAt(2460010.5), earth, 2460000.5)
		expect(buffers.count).toBe(10)
		expect(buffers.headVertex).toBe(10)
		// running back past the restart: the head leads
		updateTrails(buffers, frameAt(2459995.5), earth, 2460000.5)
		expect(buffers.headVertex).toBe(0)
		expect(buffers.count).toBe(5)
	})
})

describe("trailAlpha", () => {
	it("fades the tail and keeps the head opaque", () => {
		expect(trailAlpha(9, 10, true)).toBe(1)
		expect(trailAlpha(0, 10, true)).toBe(0)
		expect(trailAlpha(0, 10, false)).toBe(1)
		expect(trailAlpha(4, 10, true)).toBeGreaterThan(trailAlpha(3, 10, true))
	})
})
