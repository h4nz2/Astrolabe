/**
 * The camera's numbers (docs/ARCHITECTURE.md, "Camera"), kept free of React and
 * drei so the rules can be unit-tested: near/far planes, dolly limits and the
 * framing distances CameraRig flies to.
 */
import type { BodyKind } from "@/data"
import { toUnits } from "@/sim"

/**
 * Near plane, scene units (10 m). The logarithmic depth buffer's resolution
 * depends on the far plane alone, so a tiny near plane costs nothing, and it
 * has to be smaller than the gap between the eye and the surface of the
 * smallest moon (0.3 km) at the closest dolly.
 */
export const CAMERA_NEAR = 1e-5
export const CAMERA_FAR = 1e9
export const CAMERA_FOV_DEG = 45
/** Farthest dolly, scene units (1e10 km, about 66 AU). */
export const CAMERA_MAX_DISTANCE = toUnits(1e10)
/** Closest dolly, in focus radii. */
export const MIN_DISTANCE_RADII = 1.2
/** Distance a focus change dollies to, in focus radii. */
export const FRAMING_RADII = 6
/** Distance the Sun is framed from on the first mount, in solar radii. */
export const INITIAL_SUN_RADII = 40
export const INITIAL_ELEVATION_DEG = 45
export const CAMERA_SMOOTH_TIME_S = 0.4

/**
 * Closest the eye may come to the focus centre, scene units: 1.2 radii, but
 * never so close that the surface crosses the near plane (two near planes of
 * clearance), so sub-kilometre moons can be inspected without being clipped.
 */
export const minDollyDistance = (radiusUnits: number): number =>
	Math.max(MIN_DISTANCE_RADII * radiusUnits, radiusUnits + 2 * CAMERA_NEAR)

/**
 * Distance the focus is framed from, scene units: the Sun at 40 radii on the
 * first mount, every other framing at 6 radii.
 */
export const framingDistance = (
	kind: BodyKind,
	radiusUnits: number,
	firstMount: boolean,
): number =>
	(firstMount && kind === "star" ? INITIAL_SUN_RADII : FRAMING_RADII) *
	radiusUnits
