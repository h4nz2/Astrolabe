import { describe, expect, it } from "vitest"

import { SECONDS_PER_DAY } from "../../../src/sim/units"
import { hermitePosition } from "../../../src/sim/hermite"

import { parseVectors, vectorUrl } from "./horizons"
import {
	coarseWindows,
	cutHoles,
	distanceAt,
	emptySeries,
	mergeSeries,
	pickSamples,
	runs,
	simplify,
	sweptAngle,
	type StateSeries,
} from "./sampling"

/** A circular orbit of radius `r` km and period `days`, sampled every `step` days. */
function circle(
	r: number,
	days: number,
	step: number,
	span = days,
): StateSeries {
	const series = emptySeries()
	const w = (2 * Math.PI) / (days * SECONDS_PER_DAY)
	for (let t = 0; t <= span + 1e-9; t += step) {
		const a = (2 * Math.PI * t) / days
		series.jd.push(2451545 + t)
		series.p.push(r * Math.cos(a), r * Math.sin(a), 0)
		series.v.push(-r * w * Math.sin(a), r * w * Math.cos(a), 0)
	}
	return series
}

describe("sweptAngle / coarseWindows", () => {
	it("measures how far the craft turns per step", () => {
		const series = circle(1e6, 10, 1)
		expect(sweptAngle(series, 0)).toBeCloseTo((2 * Math.PI) / 10, 6)
	})
	it("flags and merges the steps that turn too far", () => {
		const coarse = mergeSeries(
			circle(1e6, 1, 0.25, 1),
			circle(1e6, 1, 0.01, 0.1),
		)
		const windows = coarseWindows(coarse, 0.2)
		expect(windows.length).toBe(1)
		expect(windows[0][0]).toBeCloseTo(2451545.1, 6)
		expect(windows[0][1]).toBeCloseTo(2451546, 6)
	})
})

describe("mergeSeries", () => {
	it("interleaves by time and lets the second series win at the same instant", () => {
		const a = circle(1, 1, 0.5, 1)
		const b = circle(2, 1, 0.25, 0.5)
		const merged = mergeSeries(a, b)
		expect(merged.jd.map((jd) => jd - 2451545)).toEqual([0, 0.25, 0.5, 1])
		expect(distanceAt(merged, 0)).toBeCloseTo(2, 9)
		expect(distanceAt(merged, 3)).toBeCloseTo(1, 9)
	})
})

describe("simplify", () => {
	it("keeps the ends and rebuilds every dropped sample within tolerance", () => {
		const dense = circle(1e6, 10, 0.01)
		const tolerance = (r: number) => 1e-3 * r
		const kept = simplify(dense, tolerance)
		expect(kept[0]).toBe(0)
		expect(kept[kept.length - 1]).toBe(dense.jd.length - 1)
		expect(kept.length).toBeLessThan(dense.jd.length / 10)
		const sparse = pickSamples(dense, kept)
		const out = [0, 0, 0]
		for (let k = 0; k < dense.jd.length; k++) {
			const jd = dense.jd[k]
			let i = sparse.jd.findIndex((t) => t > jd) - 1
			if (i < 0) i = sparse.jd.length - 2
			hermitePosition(sparse.jd, sparse.p, sparse.v, i, i + 1, jd, out)
			const error = Math.hypot(
				out[0] - dense.p[k * 3],
				out[1] - dense.p[k * 3 + 1],
				out[2] - dense.p[k * 3 + 2],
			)
			expect(error).toBeLessThanOrEqual(tolerance(1e6) + 1e-6)
		}
	})
	it("keeps short series whole", () => {
		expect(simplify(circle(1, 1, 1), () => 1)).toEqual([0, 1])
	})
})

describe("runs", () => {
	it("finds maximal runs", () => {
		const inside = [false, true, true, false, true]
		expect(runs(inside.length, (k) => inside[k])).toEqual([
			[1, 2],
			[4, 4],
		])
	})
})

describe("cutHoles", () => {
	const series = circle(1, 100, 1, 10) // days 0..10
	const days = (piece: StateSeries) => piece.jd.map((jd) => jd - 2451545)

	it("cuts a hole, each piece reaching one sample into it", () => {
		const pieces = cutHoles(series, [[2451545 + 3.5, 2451545 + 6.5]])
		expect(pieces.map(days)).toEqual([
			[0, 1, 2, 3, 4],
			[6, 7, 8, 9, 10],
		])
	})
	it("leaves a hole inside one interval alone", () => {
		const pieces = cutHoles(series, [[2451545 + 3.2, 2451545 + 3.8]])
		expect(pieces.map(days)).toEqual([[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]])
	})
	it("drops a piece that would be a single sample (a hole from the start)", () => {
		const pieces = cutHoles(series, [[2451545 - 1, 2451545 + 2.5]])
		expect(pieces.map(days)).toEqual([[2, 3, 4, 5, 6, 7, 8, 9, 10]])
	})
})

describe("Horizons", () => {
	it("asks for geometric ecliptic J2000 states in km, km/s and UT", () => {
		const url = new URL(
			vectorUrl({
				command: "-31",
				center: "500@599",
				startJD: 2443937.5,
				stopJD: 2443938.5,
				stepMinutes: 30,
			}),
		)
		const q = url.searchParams
		expect(q.get("COMMAND")).toBe("'-31'")
		expect(q.get("CENTER")).toBe("'500@599'")
		expect(q.get("REF_PLANE")).toBe("'ECLIPTIC'")
		expect(q.get("TIME_TYPE")).toBe("'UT'")
		expect(q.get("OUT_UNITS")).toBe("'KM-S'")
		expect(q.get("VEC_CORR")).toBe("'NONE'")
		expect(q.get("STEP_SIZE")).toBe("'30m'")
	})

	it("parses the CSV vector table", () => {
		const text = `header
$$SOE
2443937.500000000, A.D. 1979-Mar-05 00:00:00.0000,  7.359546961889708E+05, -5.683223054149684E+05, -2.445828861840110E+04, -6.380138980341806E+00,  1.864084368311715E+01, -2.656874299103720E-01,
2443937.520833333, A.D. 1979-Mar-05 00:30:00.0000,  7.242775739797143E+05, -5.346220706418473E+05, -2.493004052974889E+04, -6.597374579973885E+00,  1.880484277692571E+01, -2.583391433664426E-01,
$$EOE
footer`
		const series = parseVectors(text)
		expect(series.jd).toEqual([2443937.5, 2443937.520833333])
		expect(series.p[0]).toBeCloseTo(735954.6961889708, 6)
		expect(series.v[5]).toBeCloseTo(-0.2583391433664426, 12)
	})

	it("reports Horizons' own reason when there is no table", () => {
		expect(() =>
			parseVectors(
				'API VERSION: 1.2\n\nNo ephemeris for target "Voyager 1" prior to A.D. 1977-SEP-05',
			),
		).toThrow(/No ephemeris/)
	})
})
