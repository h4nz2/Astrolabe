/**
 * Comets (#23): when their tails grow and where they point. Pure, true kilometres only.
 *
 * A comet's nucleus is a few kilometres of ice and dust. Far from the Sun it is inert;
 * sunlight warms it as it falls inward, the ice turns straight to gas, and the gas and the
 * dust it carries off make the coma and the tails. The tails always point AWAY from the Sun,
 * pushed by sunlight and the solar wind, not trailing behind the comet: on the way out the
 * tail goes first. That surprise is what the drawing shows, so the direction here is the
 * true anti-Sun direction from the true positions (the #22 lighting model's Sun direction),
 * never a direction measured in the drawn, scaled scene.
 *
 * The length model is deliberately simple and monotone: nothing inside
 * `TAIL_ONSET_KM` (4 AU, about where water ice starts to sublimate), a smooth rise to full
 * activity at `TAIL_FULL_KM` (1.5 AU), and within that a length that grows as 1 / r toward
 * the Sun, scaled per comet by its curated length at 1 AU (`tail.lengthKmAt1Au`).
 */
import type { Tail } from "@/data/schema"

import { meanAnomalyAt, orbitalPeriodToMeanMotion, TWO_PI } from "./kepler"
import type { OrbitElements } from "./kepler"
import { AU_KM } from "./units"

/** Beyond this distance from the Sun (km) a comet has no coma and no tail. */
export const TAIL_ONSET_KM = 4 * AU_KM
/** Inside this distance (km) the comet is fully active. */
export const TAIL_FULL_KM = 1.5 * AU_KM

/** 0 (asleep) .. 1 (fully active) at `distanceKm` from the Sun. */
export function cometActivity(distanceKm: number): number {
	if (!(distanceKm < TAIL_ONSET_KM)) return 0
	if (distanceKm <= TAIL_FULL_KM) return 1
	const t = (TAIL_ONSET_KM - distanceKm) / (TAIL_ONSET_KM - TAIL_FULL_KM)
	return t * t * (3 - 2 * t)
}

/** True length (km) of the tail at `distanceKm` from the Sun: 0 beyond 4 AU, growing toward the Sun. */
export function tailLengthKm(tail: Tail, distanceKm: number): number {
	if (!(distanceKm > 0)) return 0
	return (tail.lengthKmAt1Au * cometActivity(distanceKm) * AU_KM) / distanceKm
}

/**
 * Unit vector from the Sun through the comet (both TRUE positions, km), written into
 * `out[at..at + 2]`: the direction every tail points. Zero when they coincide.
 */
export function antiSunDirection(
	comet: ArrayLike<number>,
	cometAt: number,
	sun: ArrayLike<number>,
	sunAt: number,
	out: Float64Array,
	at = 0,
): number {
	const x = comet[cometAt] - sun[sunAt]
	const y = comet[cometAt + 1] - sun[sunAt + 1]
	const z = comet[cometAt + 2] - sun[sunAt + 2]
	const d = Math.hypot(x, y, z)
	const k = d > 0 ? 1 / d : 0
	out[at] = x * k
	out[at + 1] = y * k
	out[at + 2] = z * k
	return d
}

/** Julian Date of the first perihelion passage strictly after `jd`. */
export function nextPerihelionJD(orbit: OrbitElements, jd: number): number {
	const n = orbitalPeriodToMeanMotion(orbit.periodDays)
	const m = meanAnomalyAt(orbit, jd)
	const days = (TWO_PI - m) / n
	return jd + (days > 0 ? days : orbit.periodDays)
}

/** Julian Date of the last perihelion passage at or before `jd`. */
export const previousPerihelionJD = (
	orbit: OrbitElements,
	jd: number,
): number => nextPerihelionJD(orbit, jd) - orbit.periodDays
