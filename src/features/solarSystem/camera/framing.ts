/**
 * The camera's numbers (docs/ARCHITECTURE.md, "Camera"), kept free of React and
 * drei so the rules can be unit-tested: near/far planes, dolly limits and the
 * default framing distance of every view.
 */
import { bodyById, planets, sun, type Body } from "@/data"
import { degToRad, toUnits } from "@/sim"
import { type View, viewBodyId } from "@/store/navigation"

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
 * the overview, which frames Neptune's orbit from 80 AU (landscape) to about
 * 190 AU (a tall phone).
 */
export const CAMERA_MAX_DISTANCE = toUnits(1e11)
/** Closest dolly, in focus radii. */
export const MIN_DISTANCE_RADII = 1.2
/** Default distance of a focused body, in its rendered radii. */
export const FRAMING_RADII = 6
export const CAMERA_SMOOTH_TIME_S = 0.4

/**
 * A body's radius as rendered, scene units. The one place the camera reads a
 * body's size: framing, dolly limits and transit paths all go through it, so a
 * size scale (#8, #21) only has to change this function.
 */
export const renderedRadius = (body: Pick<Body, "radiusKm">): number =>
	toUnits(body.radiusKm)

/** Radius of the region the overview shows: the farthest planet's aphelion, scene units. */
export const OVERVIEW_RADIUS = Math.max(
	...planets.map((planet) =>
		planet.orbit === null
			? 0
			: toUnits(planet.orbit.semiMajorAxisKm * (1 + planet.orbit.eccentricity)),
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

/**
 * Room around the planetary system in the overview, so the HUD panels at the
 * top and bottom of the screen do not cover the outermost orbit.
 */
export const OVERVIEW_MARGIN = 1.3

/** The overview's default distance: the whole planetary system on screen. */
export const overviewDistance = (fovDeg: number, aspect: number): number =>
	fitDistance(OVERVIEW_MARGIN * OVERVIEW_RADIUS, fovDeg, aspect)

const viewBody = (view: View): Body => bodyById.get(viewBodyId(view)) ?? sun

/**
 * The distance a shot's `distance: 1` stands for, scene units: the whole
 * system for the overview, `FRAMING_RADII` rendered radii of the body (or of
 * the anchor of a point) otherwise.
 */
export function defaultDistance(
	view: View,
	fovDeg: number,
	aspect: number,
): number {
	if (view.kind === "overview") return overviewDistance(fovDeg, aspect)
	return FRAMING_RADII * renderedRadius(viewBody(view))
}

/**
 * Closest dolly for a view: the body's `minDollyDistance`; for a point in
 * empty space (nothing to crash into) only the near-plane clearance.
 */
export const minViewDistance = (view: View): number =>
	view.kind === "point"
		? minDollyDistance(0)
		: minDollyDistance(renderedRadius(viewBody(view)))
