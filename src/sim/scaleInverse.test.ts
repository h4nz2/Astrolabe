import { describe, expect, it } from "vitest"

import {
	SCALE_PRESETS,
	SCALE_PRESET_IDS,
	displayOffset,
	mapDistance,
	trueOffset,
	unmapDistance,
} from "./scale"

const expectNear = (actual: number, expected: number) =>
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
		1e-9 * Math.max(1, Math.abs(expected)),
	)

const curves = SCALE_PRESET_IDS.flatMap((id) => [
	[`${id} orbitDistance`, SCALE_PRESETS[id].orbitDistance] as const,
	[`${id} moonDistance`, SCALE_PRESETS[id].moonDistance] as const,
])

describe("unmapDistance (the inverse of mapDistance)", () => {
	it.each(curves)("round-trips every distance under %s", (_name, curve) => {
		for (const x of [0, 0.5, 1, 2.9, 3, 3.1, 10, 215, 1e3, 6.5e3, 1e6]) {
			expectNear(unmapDistance(curve, mapDistance(curve, x)), x)
		}
	})

	it("is the identity up to the knee", () => {
		const curve = { knee: 3, exponent: 0.2, gain: 2 }
		expect(unmapDistance(curve, 2)).toBe(2)
		expect(unmapDistance(curve, 3)).toBe(3)
	})
})

describe("trueOffset (the inverse of displayOffset)", () => {
	it.each(curves)(
		"finds the true point behind a drawn one under %s",
		(_n, curve) => {
			const drawn = new Float64Array(3)
			const back = new Float64Array(3)
			for (const offset of [
				[0, 0, 0],
				[1000, 0, 0],
				[3e5, -2e5, 1e4],
				[1.5e8, 2e7, -3e6],
			] as const) {
				// a planet drawn 10x its true radius, and the Sun at true size
				for (const [radius, drawnRadius] of [
					[6371, 63710],
					[695700, 695700],
				]) {
					displayOffset(
						offset[0],
						offset[1],
						offset[2],
						radius,
						drawnRadius,
						curve,
						drawn,
					)
					trueOffset(
						drawn[0],
						drawn[1],
						drawn[2],
						radius,
						drawnRadius,
						curve,
						back,
					)
					for (let i = 0; i < 3; i++) {
						expectNear(back[i], offset[i])
					}
				}
			}
		},
	)
})
