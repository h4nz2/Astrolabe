/**
 * Moon orbits appear when they mean something (#17, docs/ARCHITECTURE.md,
 * "Moons"). Seen from afar a moon system is a few pixels wide and its orbit
 * lines are only a knot around the planet (the tangle #8, #20 and #21 reported
 * around Jupiter and Saturn in the overview and in Textbook). So a moon's orbit
 * line fades in with its size on screen: invisible while the drawn orbit is
 * smaller than `ORBIT_FADE_START_PX` in radius, full strength from
 * `ORBIT_FADE_FULL_PX`. Approaching a planet therefore draws its moon system
 * in, whatever the scale preset, because it is measured in pixels, not in km.
 *
 * The long tail (moons that are not `featured`) is drawn fainter
 * (`LONG_TAIL_ORBIT_FACTOR`), so with all moons shown the featured orbits
 * still read as the system and the rest as the swarm around it.
 */
import type { Body } from "@/data"

/** Below this drawn orbit radius on screen (px) a moon's orbit line is not drawn at all. */
export const ORBIT_FADE_START_PX = 14
/** From this drawn orbit radius on screen (px) a moon's orbit line has its full opacity. */
export const ORBIT_FADE_FULL_PX = 48
/** Opacity of a long-tail moon's orbit relative to a featured moon's. */
export const LONG_TAIL_ORBIT_FACTOR = 0.4

const smoothstep = (edge0: number, edge1: number, x: number): number => {
	const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
	return t * t * (3 - 2 * t)
}

/**
 * Screen radius (px) of an orbit of drawn radius `orbitRadiusUnits` around a
 * parent `distanceUnits` from the camera; `pxPerUnit` is the pixels per scene
 * unit at distance 1. Infinite with the camera at the parent.
 */
export const orbitScreenRadiusPx = (
	orbitRadiusUnits: number,
	distanceUnits: number,
	pxPerUnit: number,
): number =>
	distanceUnits > 0
		? (orbitRadiusUnits * pxPerUnit) / distanceUnits
		: Number.POSITIVE_INFINITY

/**
 * Opacity factor (0..1) of a moon's orbit line drawn `radiusPx` wide on
 * screen: 0 below `ORBIT_FADE_START_PX`, 1 (the long tail:
 * `LONG_TAIL_ORBIT_FACTOR`) from `ORBIT_FADE_FULL_PX`, smooth in between.
 */
export const moonOrbitFade = (
	radiusPx: number,
	moon: Pick<Body, "featured">,
): number =>
	smoothstep(ORBIT_FADE_START_PX, ORBIT_FADE_FULL_PX, radiusPx) *
	(moon.featured ? 1 : LONG_TAIL_ORBIT_FACTOR)
