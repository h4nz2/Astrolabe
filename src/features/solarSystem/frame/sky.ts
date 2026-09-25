/**
 * What the sky looks like from the body a frame holds still (#31), as numbers
 * for the HUD: whether a planet is moving forwards or backwards (retrograde)
 * against the stars, and which phase a moon shows. Pure, in TRUE km, from
 * single-body positions (src/sim/referenceFrame.ts `bodyPositionAt`).
 */
import type { Body } from "@/data"
import {
	RAD_TO_DEG,
	angleBetween,
	illuminatedFraction,
	sceneToEcliptic,
	type Vec3,
} from "@/sim"
import { bodyPositionAt } from "@/sim/referenceFrame"

export interface SkyBodies {
	readonly bodies: readonly Body[]
	readonly index: ReadonlyMap<string, number>
}

const a = new Float64Array(3)
const b = new Float64Array(3)
const ecliptic: Vec3 = { x: 0, y: 0, z: 0 }

/** Ecliptic longitude (degrees, 0..360) of body `target` seen from body `observer` at `jd`. */
export function eclipticLongitude(
	sky: SkyBodies,
	observer: number,
	target: number,
	jd: number,
): number {
	bodyPositionAt(sky.bodies, sky.index, observer, jd, a)
	bodyPositionAt(sky.bodies, sky.index, target, jd, b)
	sceneToEcliptic({ x: b[0] - a[0], y: b[1] - a[1], z: b[2] - a[2] }, ecliptic)
	const deg = Math.atan2(ecliptic.y, ecliptic.x) * RAD_TO_DEG
	return deg < 0 ? deg + 360 : deg
}

/** Wraps a difference of angles into (-180, 180]. */
const wrap180 = (deg: number): number => {
	const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180
	return wrapped === -180 ? 180 : wrapped
}

/** How fast (degrees per day) `target` moves along the ecliptic seen from `observer`; negative is retrograde. */
export function apparentRateDegPerDay(
	sky: SkyBodies,
	observer: number,
	target: number,
	jd: number,
): number {
	const before = eclipticLongitude(sky, observer, target, jd - 0.5)
	const after = eclipticLongitude(sky, observer, target, jd + 0.5)
	return wrap180(after - before)
}

export type ApparentMotion = "prograde" | "stationary" | "retrograde"

/**
 * Below this rate (degrees a day) a planet counts as standing still, turning
 * round: about a tenth of Mars's usual pace, a couple of days either side of
 * each stationary point.
 */
export const STATIONARY_DEG_PER_DAY = 0.05

/** Forwards (eastwards, like the Sun), standing still, or backwards (retrograde) against the stars. */
export function apparentMotion(rateDegPerDay: number): ApparentMotion {
	if (Math.abs(rateDegPerDay) < STATIONARY_DEG_PER_DAY) return "stationary"
	return rateDegPerDay < 0 ? "retrograde" : "prograde"
}

export const PHASE_IDS = [
	"new",
	"waxingCrescent",
	"firstQuarter",
	"waxingGibbous",
	"full",
	"waningGibbous",
	"lastQuarter",
	"waningCrescent",
] as const
export type PhaseId = (typeof PHASE_IDS)[number]

export interface Phase {
	id: PhaseId
	/** Share of the disc that is lit, 0..1. */
	fraction: number
	/** Angle Sun - body - observer, degrees: 0 full, 180 new. */
	phaseAngleDeg: number
	/** Growing towards full (lit on the right, seen from the northern hemisphere). */
	waxing: boolean
}

/**
 * The phase body `target` shows to `observer` (lit by the root, the Sun):
 * named from its elongation east of the Sun, in the eight traditional
 * steps of 45 degrees.
 */
export function phaseOf(
	sky: SkyBodies,
	observer: number,
	target: number,
	sun: number,
	jd: number,
): Phase {
	const elongation =
		(eclipticLongitude(sky, observer, target, jd) -
			eclipticLongitude(sky, observer, sun, jd) +
			360) %
		360
	bodyPositionAt(sky.bodies, sky.index, target, jd, a)
	bodyPositionAt(sky.bodies, sky.index, observer, jd, b)
	const sunKm = bodyPositionAt(
		sky.bodies,
		sky.index,
		sun,
		jd,
		new Float64Array(3),
	)
	const angle = angleBetween(
		sunKm[0] - a[0],
		sunKm[1] - a[1],
		sunKm[2] - a[2],
		b[0] - a[0],
		b[1] - a[1],
		b[2] - a[2],
	)
	const step = Math.floor(((elongation + 22.5) % 360) / 45)
	return {
		id: PHASE_IDS[step],
		fraction: illuminatedFraction(angle),
		phaseAngleDeg: angle * RAD_TO_DEG,
		waxing: elongation < 180,
	}
}

/**
 * SVG path of the lit part of a disc of radius `r` centred on the origin
 * (y down): the lit half-circle plus the terminator, an ellipse of
 * half-width `r * |cos(phase angle)|`, bulging into the dark side when
 * gibbous and into the lit side when a crescent. Lit on the right while
 * waxing.
 */
export function litPath(phase: Phase, r: number): string {
	const cos = Math.cos((phase.phaseAngleDeg * Math.PI) / 180)
	const rx = Math.max(0.001, Math.abs(cos) * r)
	// the lit limb from top to bottom on the lit side
	const limbSweep = phase.waxing ? 1 : 0
	// back up along the terminator: through the dark side when gibbous (cos > 0)
	const gibbous = cos > 0
	const terminatorSweep = gibbous === phase.waxing ? 1 : 0
	const top = `0 ${-r}`
	const bottom = `0 ${r}`
	return `M ${top} A ${r} ${r} 0 0 ${limbSweep} ${bottom} A ${rx.toFixed(3)} ${r} 0 0 ${terminatorSweep} ${top} Z`
}
