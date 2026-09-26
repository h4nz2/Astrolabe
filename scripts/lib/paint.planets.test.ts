import { describe, expect, it } from "vitest"

import {
	areaMean,
	bandProfile,
	closeSeam,
	hexToRgb,
	mirrorPoles,
	paintBands,
	resample,
	stretch,
	type Gray,
} from "./paint"

const gray = (
	width: number,
	height: number,
	f: (x: number, y: number) => number,
): Gray => {
	const data = new Float32Array(width * height)
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) data[y * width + x] = f(x, y)
	return { width, height, data }
}

describe("bandProfile", () => {
	const profile = bandProfile([
		[60, "#ffffff"],
		[0, "#000000"],
		[-60, "#ff0000"],
	])

	it("interpolates between stops and holds the ends", () => {
		expect(profile(90)).toEqual([1, 1, 1])
		expect(profile(30)[0]).toBeCloseTo(0.5, 5)
		expect(profile(0)).toEqual([0, 0, 0])
		expect(profile(-30)).toEqual([0.5, 0, 0])
		expect(profile(-90)).toEqual([1, 0, 0])
	})
})

describe("paintBands", () => {
	const recipe = {
		bands: [
			[90, "#e0c090"],
			[10, "#e0c090"],
			[-10, "#806040"],
			[-90, "#806040"],
		] as [number, string][],
		turbulence: 0,
	}

	it("paints the profile row by row when calm, and is deterministic", () => {
		const a = paintBands(recipe, 7, 64)
		const b = paintBands(recipe, 7, 64)
		expect(a.data).toEqual(b.data)
		const [r] = hexToRgb("#e0c090")
		expect(a.data[3 * (4 * 64 + 10)]).toBeCloseTo(r, 1)
		const [rd] = hexToRgb("#806040")
		expect(a.data[3 * (28 * 64 + 50)]).toBeCloseTo(rd, 1)
	})

	it("turbulence makes a row vary along the bands", () => {
		const stormy = paintBands({ ...recipe, turbulence: 1 }, 7, 128)
		const row = 32 // the equator, where the colours change
		const values = Array.from(
			{ length: 128 },
			(_, x) => stormy.data[3 * (row * 128 + x)],
		)
		expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.05)
	})

	it("draws a spot where it is, with its colour at the centre", () => {
		const spotted = paintBands(
			{
				...recipe,
				spots: [
					{
						lat: 45,
						lon: 0,
						width: 20,
						height: 10,
						colour: "#000000",
						opacity: 1,
					},
				],
			},
			7,
			128,
		)
		// lat 45 is row 16 of 64, lon 0 is column 64
		const centre = 3 * (16 * 128 + 64)
		expect(spotted.data[centre]).toBeLessThan(0.05)
		const away = 3 * (16 * 128 + 10)
		expect(spotted.data[away]).toBeGreaterThan(0.5)
	})
})

describe("mirrorPoles", () => {
	it("keeps everything within maxLat and mirrors the rest in from below it", () => {
		const g = gray(8, 36, (x, y) => y + x / 10) // one row per 5 deg
		const out = mirrorPoles(g, 60)
		// rows 6..29 (lat 60..-60) untouched
		for (let y = 6; y < 30; y++) expect(out.data[y * 8]).toBe(g.data[y * 8])
		// just beyond 60 N mirrors just within it, faded a little towards the ring mean
		expect(out.data[5 * 8]).toBeCloseTo(g.data[6 * 8], 0)
		expect(out.data[5 * 8 + 3]).toBeGreaterThan(out.data[5 * 8])
	})
})

describe("closeSeam", () => {
	it("makes the left and right edges meet", () => {
		const g = gray(40, 2, (x) => x)
		const out = closeSeam(g, 1, 5)
		expect(out.data[0]).toBeCloseTo(out.data[39], 5)
		expect(out.data[20]).toBe(20)
	})
})

describe("resample and stretch", () => {
	it("keeps the mean when shrinking", () => {
		const g = gray(
			360,
			108,
			(x, y) => 0.5 + 0.3 * Math.sin(x / 7) * Math.cos(y / 5),
		)
		const small = resample(g, 128, 64)
		expect(small).toMatchObject({ width: 128, height: 64 })
		const mean = (d: Float32Array) => d.reduce((s, v) => s + v, 0) / d.length
		expect(mean(small.data)).toBeCloseTo(mean(g.data), 2)
	})

	it("stretch compresses the range and leaves a mean of 1", () => {
		const g = gray(64, 32, (x) => (x < 32 ? 1 : 16))
		const s = stretch(g, 0.5)
		expect(areaMean(s)).toBeCloseTo(1, 5)
		expect(s.data[40] / s.data[0]).toBeCloseTo(4, 5)
	})
})
