/**
 * A planet's moon system as the card presents it (#17, docs/ARCHITECTURE.md,
 * "Moons"): the featured moons by name, the size of the long tail, and a
 * camera shot that shows the whole drawn system at once.
 */
import { moonsOf, type Body } from "@/data"
import {
	childDistanceCurve,
	displayDistanceKm,
	type ScaleSettings,
} from "@/sim"

import { CAMERA_FOV_DEG, FRAMING_RADII, fitDistance } from "../camera/framing"

/** Margin around the outermost drawn orbit in the system shot. */
export const SYSTEM_MARGIN = 1.15
/** The system shot looks down on the orbits from this elevation (degrees), so they read as rings. */
export const SYSTEM_ELEVATION_DEG = 35

export interface MoonSystem {
	/** The featured moons in orbital order (the order `moonsOf` gives). */
	featured: Body[]
	/** The long tail: moons that are not featured. */
	others: Body[]
}

export function moonSystemOf(planetId: string): MoonSystem {
	const moons = moonsOf(planetId)
	return {
		featured: moons.filter((moon) => moon.featured),
		others: moons.filter((moon) => !moon.featured),
	}
}

/**
 * The shot distance (a multiple of the planet's default framing,
 * `FRAMING_RADII` drawn radii) that fits the drawn apoapsis of the outermost of
 * `moons` under `scale`, with `SYSTEM_MARGIN`, in a view of `aspect`. At least
 * 1: the system view never comes closer than the close-up. 1 without moons.
 */
export function moonSystemShotDistance(
	planet: Pick<Body, "radiusKm" | "parentId">,
	moons: readonly Pick<Body, "orbit">[],
	scale: ScaleSettings,
	aspect: number,
): number {
	const curve = childDistanceCurve(scale, planet.parentId === null)
	let radii = 0
	for (const moon of moons) {
		if (moon.orbit === null) continue
		const apoapsisKm =
			moon.orbit.semiMajorAxisKm * (1 + moon.orbit.eccentricity)
		// in drawn parent radii: a drawn radius of 1
		radii = Math.max(
			radii,
			displayDistanceKm(apoapsisKm, planet.radiusKm, 1, curve),
		)
	}
	if (radii === 0) return 1
	const distance = fitDistance(SYSTEM_MARGIN * radii, CAMERA_FOV_DEG, aspect)
	return Math.max(1, distance / FRAMING_RADII)
}
