/**
 * Cubic Hermite interpolation of a state (position and velocity) between two
 * samples of a trajectory (issue #35, docs/ARCHITECTURE.md, "Spacecraft").
 *
 * A trajectory stored as sparse samples of position AND velocity is
 * reconstructed far more accurately by a cubic that matches both at each end
 * than by straight chords: the build script (scripts/build-spacecraft.ts)
 * keeps only as many samples as this interpolation needs to stay within its
 * tolerance, and the app interpolates with exactly the same function.
 *
 * Units: times in days (Julian Dates or days from any epoch), positions in km,
 * velocities in km/s. Pure, allocation-free.
 */
import { SECONDS_PER_DAY } from "./units"

import type { WritableVec3 } from "./positions"

/**
 * Position (km) at time `t` between sample `i` and sample `j` of the flat
 * arrays `times` (days), `positions` and `velocities` (3 per sample), written
 * into `out[at..at + 2]`. `t` outside [times[i], times[j]] extrapolates the
 * cubic; callers pick the bracketing pair.
 */
export function hermitePosition(
	times: ArrayLike<number>,
	positions: ArrayLike<number>,
	velocities: ArrayLike<number>,
	i: number,
	j: number,
	t: number,
	out: WritableVec3,
	at = 0,
): void {
	const t0 = times[i]
	const span = times[j] - t0
	const a = i * 3
	const b = j * 3
	if (!(span > 0)) {
		out[at] = positions[a]
		out[at + 1] = positions[a + 1]
		out[at + 2] = positions[a + 2]
		return
	}
	const s = (t - t0) / span
	const s2 = s * s
	const s3 = s2 * s
	const h00 = 2 * s3 - 3 * s2 + 1
	const h01 = -2 * s3 + 3 * s2
	// the velocity terms are scaled by the interval in seconds
	const h10 = (s3 - 2 * s2 + s) * span * SECONDS_PER_DAY
	const h11 = (s3 - s2) * span * SECONDS_PER_DAY
	for (let k = 0; k < 3; k++) {
		out[at + k] =
			h00 * positions[a + k] +
			h10 * velocities[a + k] +
			h01 * positions[b + k] +
			h11 * velocities[b + k]
	}
}

/** Velocity (km/s) of the same cubic at `t`: the derivative of `hermitePosition`. */
export function hermiteVelocity(
	times: ArrayLike<number>,
	positions: ArrayLike<number>,
	velocities: ArrayLike<number>,
	i: number,
	j: number,
	t: number,
	out: WritableVec3,
	at = 0,
): void {
	const t0 = times[i]
	const span = times[j] - t0
	const a = i * 3
	const b = j * 3
	if (!(span > 0)) {
		out[at] = velocities[a]
		out[at + 1] = velocities[a + 1]
		out[at + 2] = velocities[a + 2]
		return
	}
	const seconds = span * SECONDS_PER_DAY
	const s = (t - t0) / span
	const s2 = s * s
	// d/dt = d/ds / seconds
	const d00 = (6 * s2 - 6 * s) / seconds
	const d01 = (-6 * s2 + 6 * s) / seconds
	const d10 = 3 * s2 - 4 * s + 1
	const d11 = 3 * s2 - 2 * s
	for (let k = 0; k < 3; k++) {
		out[at + k] =
			d00 * positions[a + k] +
			d10 * velocities[a + k] +
			d01 * positions[b + k] +
			d11 * velocities[b + k]
	}
}

/**
 * Index `i` of the sample interval [times[i], times[i + 1]] holding `t`
 * (binary search; `times` ascending, at least two samples). Clamped to the
 * first and the last interval, so a `t` outside the range gets the nearest.
 */
export function bracket(times: ArrayLike<number>, t: number): number {
	let lo = 0
	let hi = times.length - 1
	if (hi < 1) return 0
	if (t <= times[0]) return 0
	if (t >= times[hi]) return hi - 1
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1
		if (times[mid] <= t) lo = mid
		else hi = mid
	}
	return lo
}
