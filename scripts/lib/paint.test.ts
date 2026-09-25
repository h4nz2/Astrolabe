import { describe, expect, it } from "vitest"

import {
	albedoToLevel,
	areaMean,
	colourize,
	correlation,
	fillGaps,
	luma,
	mulberry32,
	paintLuminance,
	rollHalf,
	softClip,
	type Gray,
} from "./paint"

const meanLuma = (rgb: {
	width: number
	height: number
	data: Float32Array
}) => {
	const data = new Float32Array(rgb.width * rgb.height)
	for (let i = 0; i < data.length; i++) {
		data[i] = luma(rgb.data[3 * i], rgb.data[3 * i + 1], rgb.data[3 * i + 2])
	}
	return areaMean({ width: rgb.width, height: rgb.height, data })
}

describe("albedoToLevel", () => {
	it("keeps the order of brightness and the darkest moons visible", () => {
		const phoebe = albedoToLevel(0.08)
		const umbriel = albedoToLevel(0.26)
		const ariel = albedoToLevel(0.53)
		const enceladus = albedoToLevel(1.38)
		expect(phoebe).toBeLessThan(umbriel)
		expect(umbriel).toBeLessThan(ariel)
		expect(ariel).toBeLessThan(enceladus)
		// on a projector a mean of 0.2 still reads as a surface, not a hole
		expect(albedoToLevel(0.04)).toBeGreaterThan(0.2)
		expect(enceladus).toBeLessThanOrEqual(0.8)
	})
})

describe("softClip", () => {
	it("leaves mid-tones alone and rolls highlights off below 1", () => {
		expect(softClip(0.5)).toBe(0.5)
		expect(softClip(1)).toBeLessThan(1)
		expect(softClip(2)).toBeLessThan(1)
		expect(softClip(1.2)).toBeGreaterThan(softClip(1))
	})
})

describe("paintLuminance", () => {
	const recipe = { pattern: "cratered" as const }

	it("paints the same moon the same way every time", () => {
		const a = paintLuminance(recipe, 42, 128)
		const b = paintLuminance(recipe, 42, 128)
		expect(a.data).toEqual(b.data)
	})

	it("never paints two moons of one family as copies", () => {
		const seeds = [1, 2, 3, 99, 12345]
		const maps = seeds.map((seed) => paintLuminance(recipe, seed, 128))
		for (let i = 0; i < maps.length; i++) {
			for (let j = i + 1; j < maps.length; j++) {
				expect(Math.abs(correlation(maps[i].data, maps[j].data))).toBeLessThan(
					0.5,
				)
			}
		}
	})

	it("keeps a mean brightness near 1, so the albedo sets the level", () => {
		for (const pattern of ["cratered", "smooth", "haze"] as const) {
			const mean = areaMean(paintLuminance({ pattern }, 7, 128))
			expect(mean, pattern).toBeGreaterThan(0.85)
			expect(mean, pattern).toBeLessThan(1.15)
		}
	})

	it("paints craters on a cratered moon and hardly any on a smooth one", () => {
		const spread = (g: Gray) => {
			const m = areaMean(g)
			return Math.sqrt(
				areaMean({ ...g, data: g.data.map((v) => (v - m) ** 2) }),
			)
		}
		expect(
			spread(paintLuminance({ pattern: "cratered" }, 5, 256)),
		).toBeGreaterThan(2 * spread(paintLuminance({ pattern: "smooth" }, 5, 256)))
	})
})

describe("colourize", () => {
	it("sets the mean brightness to the level and the colour to the hue", () => {
		const lum = paintLuminance({ pattern: "smooth" }, 3, 128)
		const rgb = colourize(lum, "#a0715a", undefined, 0.4)
		expect(meanLuma(rgb)).toBeCloseTo(0.4, 1)
		// reddish: red above blue everywhere
		for (let i = 0; i < rgb.data.length; i += 3 * 97) {
			expect(rgb.data[i]).toBeGreaterThan(rgb.data[i + 2])
		}
	})
})

describe("rollHalf", () => {
	it("moves the centre column to the edge (a 180-centred map to a 0-centred one)", () => {
		const gray: Gray = {
			width: 4,
			height: 2,
			data: Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
		}
		expect(Array.from(rollHalf(gray, 1).data)).toEqual([2, 3, 0, 1, 6, 7, 4, 5])
	})
})

describe("fillGaps", () => {
	// a map of which only the southern half was photographed, like Voyager 2's Uranian moons
	const width = 256
	const height = 128
	const south = paintLuminance({ pattern: "cratered" }, 11, width)
	const partial = new Float32Array(width * height)
	const valid = new Uint8Array(width * height)
	for (let y = height / 2; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x
			partial[i] = 0.5 * south.data[i]
			valid[i] = 1
		}
	}
	const filled = fillGaps({ width, height, data: partial }, valid)
	const half = (data: Float32Array, north: boolean) => {
		const rows = data.slice(
			north ? 0 : (width * height) / 2,
			north ? (width * height) / 2 : undefined,
		)
		return { width, height: height / 2, data: rows }
	}

	it("leaves the photographed half as it was, well inside it", () => {
		for (let y = height / 2 + 8; y < height; y++) {
			for (let x = 0; x < width; x += 13) {
				expect(filled.data[y * width + x]).toBe(partial[y * width + x])
			}
		}
	})

	it("fills the unseen half at the same brightness, with terrain, not a flat grey", () => {
		const north = half(filled.data, true)
		const southHalf = half(partial, false)
		const nm = areaMean(north)
		const sm = areaMean(southHalf)
		expect(Math.abs(nm - sm) / sm).toBeLessThan(0.15)
		const spread = (g: Gray, m: number) =>
			Math.sqrt(areaMean({ ...g, data: g.data.map((v) => (v - m) ** 2) }))
		expect(spread(north, nm)).toBeGreaterThan(0.4 * spread(southHalf, sm))
		for (const v of north.data) expect(v).toBeGreaterThan(0.05)
	})

	it("does not draw a mirror image of the photographed half", () => {
		const mirrored = new Float32Array((width * height) / 2)
		for (let y = 0; y < height / 2; y++) {
			for (let x = 0; x < width; x++) {
				mirrored[y * width + x] = partial[(height - 1 - y) * width + x]
			}
		}
		expect(correlation(half(filled.data, true).data, mirrored)).toBeLessThan(
			0.5,
		)
	})
})

describe("mulberry32", () => {
	it("is deterministic and spread over 0..1", () => {
		const a = mulberry32(9)
		const b = mulberry32(9)
		const values = Array.from({ length: 1000 }, () => a())
		expect(values.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()))
		expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
		expect(Math.max(...values)).toBeLessThan(1)
		const mean = values.reduce((s, v) => s + v, 0) / values.length
		expect(mean).toBeCloseTo(0.5, 1)
	})
})
