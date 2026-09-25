import { describe, expect, it } from "vitest"

import { bodies } from "@/data"

import { buildIndex, computePositions } from "./positions"
import {
	applyReferenceFrame,
	bodyPositionAt,
	framedOffset,
	topLevelIndices,
} from "./referenceFrame"
import {
	SCALE_PRESETS,
	TRUE_SCALE,
	computeDisplayPositions,
	computeDisplayRadii,
	type ScaleSettings,
} from "./scale"
import { J2000_JD, dateToJD } from "./time"

const index = buildIndex(bodies)
const top = topLevelIndices(bodies, index)
const at = (id: string) => index.get(id)!
const EV = SCALE_PRESETS.everythingVisible

const vec = (a: Float64Array, i: number) => [
	a[i * 3],
	a[i * 3 + 1],
	a[i * 3 + 2],
]
const sub = (a: number[], b: number[]) => a.map((v, k) => v - b[k])
const unit = (a: number[]) => {
	const l = Math.hypot(...a)
	return a.map((v) => v / l)
}

/** Heliocentric display positions, and the same drawn with Earth held still (weight `w`). */
function draw(scale: ScaleSettings, anchorId: string, w = 1, jd = J2000_JD) {
	const truePositions = computePositions(bodies, jd, undefined, index)
	const radii = computeDisplayRadii(bodies, scale)
	const helio = computeDisplayPositions(
		bodies,
		truePositions,
		radii,
		scale,
		index,
	)
	const framed = helio.slice()
	applyReferenceFrame(
		bodies,
		truePositions,
		framed,
		scale,
		top,
		{
			anchors: Int32Array.of(top[at(anchorId)], 0),
			weights: Float64Array.of(w, 0),
		},
		new Float64Array(bodies.length * 3),
	)
	return { truePositions, helio, framed }
}

describe("topLevelIndices", () => {
	it("maps moons to their planet, planets to themselves, the Sun to itself", () => {
		expect(top[at("sun")]).toBe(at("sun"))
		expect(top[at("earth")]).toBe(at("earth"))
		expect(top[at("moon")]).toBe(at("earth"))
		expect(top[at("io")]).toBe(at("jupiter"))
		expect(top[at("titan")]).toBe(at("saturn"))
	})
})

describe("bodyPositionAt", () => {
	it("equals computePositions for every body", () => {
		const jd = dateToJD(new Date("2031-05-04T00:00Z"))
		const all = computePositions(bodies, jd, undefined, index)
		const out = new Float64Array(3)
		for (const id of ["sun", "earth", "moon", "io", "neptune", "triton"]) {
			bodyPositionAt(bodies, index, at(id), jd, out)
			expect([...out]).toEqual(vec(all, at(id)))
		}
	})
})

describe("applyReferenceFrame", () => {
	it("changes nothing at true scale: the frame is only a different point of view", () => {
		const { helio, framed } = draw(TRUE_SCALE, "earth")
		for (let i = 0; i < helio.length; i++) {
			expect(framed[i]).toBeCloseTo(helio[i], -1)
		}
	})

	it("keeps the anchor and the Sun where they are", () => {
		const { helio, framed } = draw(EV, "earth")
		for (const id of ["earth", "sun", "moon"]) {
			vec(framed, at(id)).forEach((v, k) =>
				expect(v).toBeCloseTo(vec(helio, at(id))[k], -1),
			)
		}
	})

	it("draws every direction from the anchor as the true direction in the sky", () => {
		const { truePositions, helio, framed } = draw(EV, "earth")
		const earth = at("earth")
		for (const id of ["mars", "venus", "jupiter", "neptune", "sun"]) {
			const i = at(id)
			const trueDir = unit(
				sub(vec(truePositions, i), vec(truePositions, earth)),
			)
			const drawnDir = unit(sub(vec(framed, i), vec(framed, earth)))
			drawnDir.forEach((v, k) => expect(v).toBeCloseTo(trueDir[k], 9))
		}
		// the Sun-centred drawing bends them (why the frame re-roots, #8)
		const mars = at("mars")
		const helioDir = unit(sub(vec(helio, mars), vec(helio, earth)))
		const trueDir = unit(
			sub(vec(truePositions, mars), vec(truePositions, earth)),
		)
		const angle = Math.acos(
			helioDir.reduce((sum, v, k) => sum + v * trueDir[k], 0),
		)
		expect(angle).toBeGreaterThan(0.01)
	})

	it("carries moons with their planet", () => {
		const { helio, framed } = draw(EV, "earth")
		const jupiter = at("jupiter")
		const io = at("io")
		const before = sub(vec(helio, io), vec(helio, jupiter))
		const after = sub(vec(framed, io), vec(framed, jupiter))
		after.forEach((v, k) => expect(v).toBeCloseTo(before[k], 3))
	})

	it("places the other planets with the planets' distance curve from the anchor", () => {
		const { truePositions, framed } = draw(EV, "earth")
		const earth = at("earth")
		const mars = at("mars")
		const out = new Float64Array(3)
		const d = sub(vec(truePositions, mars), vec(truePositions, earth))
		framedOffset(d[0], d[1], d[2], bodies[at("sun")].radiusKm, EV, out)
		sub(vec(framed, mars), vec(framed, earth)).forEach((v, k) =>
			expect(v).toBeCloseTo(out[k], 0),
		)
	})

	it("blends linearly with the weight and does nothing without one", () => {
		const full = draw(EV, "earth", 1)
		const half = draw(EV, "earth", 0.5)
		const none = draw(EV, "earth", 0)
		const mars = at("mars")
		vec(half.framed, mars).forEach((v, k) =>
			expect(v).toBeCloseTo(
				(vec(full.framed, mars)[k] + vec(full.helio, mars)[k]) / 2,
				0,
			),
		)
		expect([...none.framed]).toEqual([...none.helio])
	})

	it("treats the Sun as an anchor as the Sun-centred frame", () => {
		const { helio, framed } = draw(EV, "sun")
		expect([...framed]).toEqual([...helio])
	})

	it("holds a moon's planet still when a moon is the anchor", () => {
		const moon = draw(EV, "moon")
		const earth = draw(EV, "earth")
		expect([...moon.framed]).toEqual([...earth.framed])
	})
})
