import { describe, expect, it } from "vitest"

import {
	FRAME_BLEND_MS,
	anchorWeight,
	anchoredWeight,
	createFrameBlendState,
	stepFrameBlend,
} from "./frameBlend"

const ROOT = 0
const EARTH = 3
const MARS = 4

const setup = () => ({
	blend: { anchors: new Int32Array(2), weights: new Float64Array(2) },
	state: createFrameBlendState(2),
})

describe("stepFrameBlend", () => {
	it("lands at once on the first step (a deep link opens in its frame)", () => {
		const { blend, state } = setup()
		stepFrameBlend(blend, state, EARTH, ROOT, 16)
		expect(anchorWeight(blend, EARTH)).toBe(1)
		expect(anchoredWeight(blend, ROOT)).toBe(1)
	})

	it("eases into a frame over FRAME_BLEND_MS and back out", () => {
		const { blend, state } = setup()
		stepFrameBlend(blend, state, ROOT, ROOT, 16)
		expect(anchoredWeight(blend, ROOT)).toBe(0)
		stepFrameBlend(blend, state, EARTH, ROOT, FRAME_BLEND_MS / 2)
		expect(anchorWeight(blend, EARTH)).toBeCloseTo(0.5, 6)
		stepFrameBlend(blend, state, EARTH, ROOT, FRAME_BLEND_MS / 4)
		const three = anchorWeight(blend, EARTH)
		expect(three).toBeGreaterThan(0.75)
		expect(three).toBeLessThan(1)
		stepFrameBlend(blend, state, EARTH, ROOT, FRAME_BLEND_MS)
		expect(anchorWeight(blend, EARTH)).toBe(1)
		stepFrameBlend(blend, state, ROOT, ROOT, FRAME_BLEND_MS / 2)
		expect(anchorWeight(blend, EARTH)).toBeCloseTo(0.5, 6)
		stepFrameBlend(blend, state, ROOT, ROOT, FRAME_BLEND_MS)
		expect(anchoredWeight(blend, ROOT)).toBe(0)
	})

	it("cross-fades from one anchor to another, never above 1 in total", () => {
		const { blend, state } = setup()
		stepFrameBlend(blend, state, EARTH, ROOT, 0)
		for (let k = 0; k < 20; k++) {
			stepFrameBlend(blend, state, MARS, ROOT, FRAME_BLEND_MS / 10)
			const earth = anchorWeight(blend, EARTH)
			const mars = anchorWeight(blend, MARS)
			expect(earth + mars).toBeLessThanOrEqual(1 + 1e-12)
		}
		expect(anchorWeight(blend, MARS)).toBe(1)
		expect(anchorWeight(blend, EARTH)).toBe(0)
	})

	it("ignores broken frame times", () => {
		const { blend, state } = setup()
		stepFrameBlend(blend, state, ROOT, ROOT, 16)
		stepFrameBlend(blend, state, EARTH, ROOT, Number.NaN)
		expect(anchorWeight(blend, EARTH)).toBe(0)
	})
})
