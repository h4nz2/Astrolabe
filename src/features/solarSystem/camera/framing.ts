/**
 * The camera's numbers (docs/ARCHITECTURE.md, "Camera"), kept free of React and
 * drei so the rules can be unit-tested: near/far planes, dolly limits and the
 * default framing distance of every view. Every size and distance here is a
 * drawn one (the active scale's, docs/ARCHITECTURE.md "Scale"), read from the
 * SimFrame, never a true one.
 */
import { planets, sun } from "@/data"
import { degToRad, displayDistanceKm, toUnits, type ScaleSettings } from "@/sim"
import { type View, viewBodyId } from "@/store/navigation"

import type { SimFrame } from "../scene/simFrame"

/**
 * Near plane, scene units (10 m). The logarithmic depth buffer's resolution
 * depends on the far plane alone, so a tiny near plane costs nothing, and it
 * has to be smaller than the gap between the eye and the surface of the
 * smallest moon (0.3 km) at the closest dolly.
 */
export const CAMERA_NEAR = 1e-5
export const CAMERA_FAR = 1e9
export const CAMERA_FOV_DEG = 45
/**
 * Farthest dolly, scene units (1e11 km, about 670 AU): room to back out of
 * the true-scale overview, which frames Neptune's orbit from 100 AU
 * (landscape) to about 250 AU (a tall phone).
 */
export const CAMERA_MAX_DISTANCE = toUnits(1e11)
/** Closest dolly, in focus radii. */
export const MIN_DISTANCE_RADII = 1.2
/** Default distance of a focused body, in its drawn radii. */
export const FRAMING_RADII = 6
export const CAMERA_SMOOTH_TIME_S = 0.4
/**
 * Room around the planetary system in the overview, so the HUD panels at the
 * top and bottom of the screen do not cover the outermost orbit.
 */
export const OVERVIEW_MARGIN = 1.3

/** What framing reads from the SimFrame: the drawn radii and the active scale. */
export type FramingFrame = Pick<SimFrame, "index" | "renderRadius" | "scale">

/**
 * Radius of the region the overview shows under `scale`: the farthest
 * planet's aphelion as drawn, scene units. The Sun (the root) keeps its true
 * size in every scale, so it is the parent radius on both sides.
 */
export const overviewRadius = (scale: ScaleSettings): number =>
	Math.max(
		...planets.map((planet) =>
			planet.orbit === null
				? 0
				: toUnits(
						displayDistanceKm(
							planet.orbit.semiMajorAxisKm * (1 + planet.orbit.eccentricity),
							sun.radiusKm,
							sun.radiusKm,
							scale.orbitDistance,
						),
					),
		),
	)

/**
 * Closest the eye may come to the focus centre, scene units: 1.2 radii, but
 * never so close that the surface crosses the near plane (two near planes of
 * clearance), so sub-kilometre moons can be inspected without being clipped.
 */
export const minDollyDistance = (radiusUnits: number): number =>
	Math.max(MIN_DISTANCE_RADII * radiusUnits, radiusUnits + 2 * CAMERA_NEAR)

/**
 * Distance from which a sphere of `radius` exactly fills the narrower of the
 * two fields of view (vertical `fovDeg`, horizontal from `aspect`).
 */
export function fitDistance(
	radius: number,
	fovDeg: number,
	aspect: number,
): number {
	const halfVertical = degToRad(fovDeg) / 2
	const halfHorizontal = Math.atan(
		Math.tan(halfVertical) * (aspect > 0 ? aspect : 1),
	)
	return radius / Math.sin(Math.min(halfVertical, halfHorizontal))
}

/** The overview's default distance: the whole planetary system on screen. */
export const overviewDistance = (
	scale: ScaleSettings,
	fovDeg: number,
	aspect: number,
): number =>
	fitDistance(OVERVIEW_MARGIN * overviewRadius(scale), fovDeg, aspect)

/** Drawn radius (scene units) of the body a view is centred on; the Sun for unknown ids. */
export const viewRadius = (view: View, frame: FramingFrame): number =>
	frame.renderRadius(
		frame.index.get(viewBodyId(view)) ?? frame.index.get(sun.id) ?? 0,
	)

/**
 * The distance a shot's `distance: 1` stands for, scene units: the whole
 * system for the overview and for a point in interplanetary space (a point
 * anchored to the Sun, #15), `FRAMING_RADII` drawn radii of the body (or of
 * the anchor of a point in its neighbourhood) otherwise, so Jupiter and
 * Mercury fill the same share of the screen.
 */
export function defaultDistance(
	view: View,
	frame: FramingFrame,
	fovDeg: number,
	aspect: number,
): number {
	if (
		view.kind === "overview" ||
		(view.kind === "point" && view.anchorId === sun.id)
	) {
		return overviewDistance(frame.scale, fovDeg, aspect)
	}
	return FRAMING_RADII * viewRadius(view, frame)
}

/**
 * Closest dolly for a view: the body's `minDollyDistance`, so the limits
 * follow whatever is at the centre. A point in empty space takes its anchor's
 * (the body whose neighbourhood it is in): around the Sun that stops a dolly
 * into empty interplanetary space at a sensible distance instead of creeping
 * towards the pivot forever, near Mercury it lets the camera come close.
 */
export const minViewDistance = (view: View, frame: FramingFrame): number =>
	minDollyDistance(viewRadius(view, frame))
