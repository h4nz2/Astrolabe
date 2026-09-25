import { describe, expect, it } from "vitest"
import { SRGBColorSpace } from "three"

import {
	createRingTextures,
	linearToSrgb,
	ringBaseLevel,
	ringMipChain,
	ringNextLevel,
	srgbToLinear,
} from "./ringTextures"

const gray = (value: number, width: number) => new Uint8Array(width).fill(value)
const rgbOf = (width: number, r: number, g: number, b: number) => {
	const bytes = new Uint8Array(width * 3)
	for (let x = 0; x < width; x++) bytes.set([r, g, b], x * 3)
	return bytes
}

describe("ring strip mip chain", () => {
	it("reads the opacity from the gray level and the colour as linear RGB", () => {
		const level = ringBaseLevel([0, 255, 51], rgbOf(3, 255, 128, 0))
		expect(Array.from(level.mean)).toEqual([0, 1, 0.2].map(Math.fround))
		expect(level.peak).toEqual(level.mean)
		expect(level.color[0]).toBeCloseTo(1, 6)
		expect(level.color[1]).toBeCloseTo(srgbToLinear(128 / 255), 6)
		expect(() => ringBaseLevel([0, 0], rgbOf(3, 0, 0, 0))).toThrow()
	})

	it("keeps the mean for the look from afar and the peak for thin rings", () => {
		// one narrow opaque ring in 64 empty texels (Uranus's epsilon ring, seen from far)
		const alpha = gray(0, 64)
		alpha[40] = 255
		const levels = ringMipChain(ringBaseLevel(alpha, rgbOf(64, 60, 60, 62)))
		expect(levels.map((level) => level.width)).toEqual([64, 32, 16, 8, 4, 2, 1])
		const last = levels[levels.length - 1]
		expect(last.mean[0]).toBeCloseTo(1 / 64, 6)
		expect(last.peak[0]).toBe(1)
		// the peak stays where the ring is at every level
		levels.forEach((level, k) => {
			const at = Math.floor(40 / 2 ** k)
			expect(level.peak[at]).toBe(1)
			expect(level.peak.reduce((sum, v) => sum + v, 0)).toBe(1)
		})
	})

	it("weights the colour by opacity, so empty space does not darken a ring", () => {
		const alpha = new Uint8Array([255, 0])
		const rgb = new Uint8Array([200, 100, 50, 0, 0, 0])
		const next = ringNextLevel(ringBaseLevel(alpha, rgb))
		expect(next.width).toBe(1)
		expect(next.mean[0]).toBeCloseTo(0.5, 6)
		expect(next.color[0]).toBeCloseTo(srgbToLinear(200 / 255), 6)
		// nothing opaque: a plain mean
		const empty = ringNextLevel(ringBaseLevel(new Uint8Array(2), rgb))
		expect(empty.color[0]).toBeCloseTo(srgbToLinear(200 / 255) / 2, 6)
	})

	it("folds the odd last texel into the last pair", () => {
		const next = ringNextLevel(
			ringBaseLevel(new Uint8Array([0, 0, 255]), rgbOf(3, 9, 9, 9)),
		)
		expect(next.width).toBe(1)
		expect(next.mean[0]).toBeCloseTo(1 / 3, 6)
		expect(next.peak[0]).toBe(1)
	})

	it("round-trips sRGB", () => {
		for (const c of [0, 0.002, 0.2, 0.5, 1]) {
			expect(linearToSrgb(srgbToLinear(c))).toBeCloseTo(c, 9)
		}
	})
})

describe("createRingTextures", () => {
	it("bakes colour + mean opacity (sRGB) and the peak into mip-mapped 1-texel strips", () => {
		const alpha = gray(0, 8)
		alpha[3] = 255
		const levels = ringMipChain(ringBaseLevel(alpha, rgbOf(8, 60, 60, 62)))
		const { color, peak } = createRingTextures(levels)
		const bytes = (texture: typeof color, level: number) =>
			(texture.mipmaps[level] as { data: Uint8Array }).data
		expect(color.colorSpace).toBe(SRGBColorSpace)
		expect(color.generateMipmaps).toBe(false)
		expect(color.mipmaps.map((m: { width: number }) => m.width)).toEqual([
			8, 4, 2, 1,
		])
		const top = bytes(color, 0)
		expect(Array.from(top.slice(12, 16))).toEqual([60, 60, 62, 255])
		const last = bytes(color, 3)
		// the colour of the only ring, a mean opacity of 1/8
		expect(Array.from(last)).toEqual([60, 60, 62, 32])
		expect(bytes(peak, 3)[0]).toBe(255)
	})
})
