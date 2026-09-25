/**
 * Pure trajectory sampling for `pnpm build:spacecraft` (issue #35): which
 * stretches of a trajectory need denser samples from JPL Horizons, and which
 * samples can be dropped because cubic Hermite interpolation
 * (src/sim/hermite.ts, the same function the app uses) rebuilds them within
 * tolerance. No I/O.
 *
 * A `StateSeries` holds states relative to one centre (the Sun or a planet):
 * times in Julian Dates (UT), positions in km, velocities in km/s, ecliptic
 * J2000 axes, times strictly ascending.
 */
import { SECONDS_PER_DAY } from "../../../src/sim/units"
import { hermitePosition } from "../../../src/sim/hermite"

export interface StateSeries {
	/** Julian Dates (UT), strictly ascending. */
	readonly jd: number[]
	/** km, 3 per sample. */
	readonly p: number[]
	/** km/s, 3 per sample. */
	readonly v: number[]
}

export const emptySeries = (): StateSeries => ({ jd: [], p: [], v: [] })

export const seriesLength = (series: StateSeries): number => series.jd.length

const norm3 = (a: readonly number[], i: number): number =>
	Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2])

/** Distance from the centre of sample `i`, km. */
export const distanceAt = (series: StateSeries, i: number): number =>
	norm3(series.p, i)

/** Speed of sample `i`, km/s. */
export const speedAt = (series: StateSeries, i: number): number =>
	norm3(series.v, i)

/**
 * The angle (radians) the craft can sweep around the centre between samples
 * `i` and `i + 1`, estimated pessimistically as the larger speed times the
 * interval over the smaller distance. Large angles are where the curvature of
 * the path is too high for the sampling step.
 */
export function sweptAngle(series: StateSeries, i: number): number {
	const seconds = (series.jd[i + 1] - series.jd[i]) * SECONDS_PER_DAY
	const speed = Math.max(speedAt(series, i), speedAt(series, i + 1))
	const distance = Math.min(distanceAt(series, i), distanceAt(series, i + 1))
	return distance > 0 ? (speed * seconds) / distance : Infinity
}

/**
 * Time windows (JD pairs) whose sampling is too coarse: consecutive intervals
 * sweeping more than `maxAngle` radians, merged into one window each.
 */
export function coarseWindows(
	series: StateSeries,
	maxAngle: number,
): [number, number][] {
	const windows: [number, number][] = []
	for (let i = 0; i + 1 < series.jd.length; i++) {
		if (sweptAngle(series, i) <= maxAngle) continue
		const from = series.jd[i]
		const to = series.jd[i + 1]
		const last = windows[windows.length - 1]
		if (last !== undefined && last[1] >= from) last[1] = to
		else windows.push([from, to])
	}
	return windows
}

/** Two samples closer than this (days, about 0.1 s) are the same instant. */
export const SAME_INSTANT_DAYS = 1e-6

/** The sorted union of two series of the same centre; a sample of `b` replaces one of `a` at the same instant. */
export function mergeSeries(a: StateSeries, b: StateSeries): StateSeries {
	const out = emptySeries()
	let i = 0
	let j = 0
	const push = (series: StateSeries, k: number) => {
		const last = out.jd[out.jd.length - 1]
		const jd = series.jd[k]
		if (last !== undefined && jd - last < SAME_INSTANT_DAYS) {
			// the finer series (b) wins at the same instant
			if (series !== b) return
			out.jd.pop()
			out.p.length -= 3
			out.v.length -= 3
		}
		out.jd.push(jd)
		out.p.push(series.p[k * 3], series.p[k * 3 + 1], series.p[k * 3 + 2])
		out.v.push(series.v[k * 3], series.v[k * 3 + 1], series.v[k * 3 + 2])
	}
	while (i < a.jd.length || j < b.jd.length) {
		if (j >= b.jd.length || (i < a.jd.length && a.jd[i] < b.jd[j])) {
			push(a, i++)
		} else {
			push(b, j++)
		}
	}
	return out
}

/** Samples `from..to` (inclusive indices) as a new series. */
export function sliceSeries(
	series: StateSeries,
	from: number,
	to: number,
): StateSeries {
	return {
		jd: series.jd.slice(from, to + 1),
		p: series.p.slice(from * 3, (to + 1) * 3),
		v: series.v.slice(from * 3, (to + 1) * 3),
	}
}

/** The samples at `indices` (ascending) as a new series. */
export function pickSamples(
	series: StateSeries,
	indices: readonly number[],
): StateSeries {
	const out = emptySeries()
	for (const k of indices) {
		out.jd.push(series.jd[k])
		out.p.push(series.p[k * 3], series.p[k * 3 + 1], series.p[k * 3 + 2])
		out.v.push(series.v[k * 3], series.v[k * 3 + 1], series.v[k * 3 + 2])
	}
	return out
}

/** Allowed interpolation error at distance `r` km from the centre, km. */
export type Tolerance = (distanceKm: number) => number

const scratch = [0, 0, 0]

/** Largest interpolation error (in multiples of the tolerance) over the samples strictly between `i` and `j`. */
function spanError(
	series: StateSeries,
	i: number,
	j: number,
	tolerance: Tolerance,
): number {
	let worst = 0
	for (let k = i + 1; k < j; k++) {
		hermitePosition(series.jd, series.p, series.v, i, j, series.jd[k], scratch)
		const o = k * 3
		const error = Math.hypot(
			scratch[0] - series.p[o],
			scratch[1] - series.p[o + 1],
			scratch[2] - series.p[o + 2],
		)
		const ratio = error / tolerance(distanceAt(series, k))
		if (ratio > worst) worst = ratio
		if (worst > 1) return worst
	}
	return worst
}

/**
 * Greedy simplification: the indices of the samples to keep so that Hermite
 * interpolation between consecutive kept samples reproduces every dropped
 * sample within `tolerance`. The first and last samples are always kept.
 * From each kept sample the next is found by doubling, then bisection.
 * `maxSpan` (samples) bounds a single interval.
 */
export function simplify(
	series: StateSeries,
	tolerance: Tolerance,
	maxSpan = 1 << 16,
): number[] {
	const n = series.jd.length
	if (n <= 2) return [...Array(n).keys()]
	const kept = [0]
	let i = 0
	while (i < n - 1) {
		let good = i + 1
		let step = 1
		let bad = -1
		// grow while it fits
		while (good < n - 1) {
			const next = Math.min(n - 1, i + step * 2, i + maxSpan)
			if (next === good) break
			if (spanError(series, i, next, tolerance) <= 1) {
				good = next
				step *= 2
			} else {
				bad = next
				break
			}
		}
		// bisect between the last fit and the first misfit
		if (bad > 0) {
			while (bad - good > 1) {
				const mid = (good + bad) >> 1
				if (spanError(series, i, mid, tolerance) <= 1) good = mid
				else bad = mid
			}
		}
		kept.push(good)
		i = good
	}
	return kept
}

/**
 * Maximal runs of samples (index pairs, inclusive) where `inside(k)` holds.
 */
export function runs(
	count: number,
	inside: (k: number) => boolean,
): [number, number][] {
	const out: [number, number][] = []
	let start = -1
	for (let k = 0; k < count; k++) {
		if (inside(k)) {
			if (start < 0) start = k
		} else if (start >= 0) {
			out.push([start, k - 1])
			start = -1
		}
	}
	if (start >= 0) out.push([start, count - 1])
	return out
}

/**
 * The pieces of `series` left after cutting out the time intervals `holes`
 * (JD pairs). Each piece reaches into a hole by one sample, so together they
 * still cover everything outside the holes up to their edges: the piece
 * before a hole ends at the first sample at or after its start, the piece
 * after it starts at the last sample at or before its end. A hole inside a
 * single sample interval cuts nothing. Pieces with fewer than two samples are
 * dropped.
 */
export function cutHoles(
	series: StateSeries,
	holes: readonly (readonly [number, number])[],
): StateSeries[] {
	const n = series.jd.length
	const cuts: [number, number][] = []
	for (const [from, to] of holes) {
		const p = series.jd.findIndex((jd) => jd >= from)
		let q = -1
		for (let k = n - 1; k >= 0; k--) {
			if (series.jd[k] <= to) {
				q = k
				break
			}
		}
		if (p < 0 || q <= p) continue
		cuts.push([p, q])
	}
	cuts.sort((a, b) => a[0] - b[0])
	const pieces: StateSeries[] = []
	let start = 0
	for (const [p, q] of cuts) {
		if (p > start) pieces.push(sliceSeries(series, start, p))
		start = Math.max(start, q)
	}
	if (n - 1 > start) pieces.push(sliceSeries(series, start, n - 1))
	return pieces
}
