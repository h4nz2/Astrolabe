/**
 * The camera's numbers (docs/ARCHITECTURE.md, "Camera"), kept free of React and
 * drei so the rules can be unit-tested: near/far planes, dolly limits and the
 * framing distances CameraRig flies to.
 */
import { Spherical } from "three"

import type { BodyKind } from "@/data"
import { toUnits } from "@/sim"

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
 * Camera distance after the focus's drawn radius changed from `fromRadius` to
 * `toRadius` (a scale change, docs/ARCHITECTURE.md "Scale"): the distance
 * scales with the radius, so the focused body keeps its size on screen while
 * everything around it moves to where the new scale puts it. Never inside the
 * body: at least `minDollyDistance(toRadius)`.
 */
export const rescaledDistance = (
	distance: number,
	fromRadius: number,
	toRadius: number,
): number =>
	Math.max(
		minDollyDistance(toRadius),
		fromRadius > 0 ? (distance * toRadius) / fromRadius : distance,
	)

/** The focus's drawn radius (scene units) as the camera rig last saw it. */
export interface FollowedRadius {
	id: string
	radius: number
}

/** The part of camera-controls `followFocusRadius` drives (drei's CameraControlsImpl satisfies it). */
export interface DollyControls {
	minDistance: number
	dollyTo(distance: number, enableTransition?: boolean): unknown
	getSpherical(out: Spherical, receiveEndValue?: boolean): Spherical
}

const endSpherical = new Spherical()

/**
 * Keeps the camera distance proportional to the focus's drawn radius across
 * scale changes (`rescaledDistance`), without a transition of its own: an
 * animated scale change (#21) is animated by whoever drives the scale, frame by
 * frame. A focus change is left to CameraRig's framing effect. Call once per
 * frame with what it returned last time.
 */
export function followFocusRadius(
	controls: DollyControls,
	previous: FollowedRadius | null,
	frame: Pick<SimFrame, "index" | "renderRadius">,
	focusId: string,
): FollowedRadius | null {
	const index = frame.index.get(focusId)
	if (index === undefined) return previous
	const radius = frame.renderRadius(index)
	if (previous !== null && previous.id === focusId) {
		if (previous.radius === radius) return previous
		// the new limit first: dollyTo clamps to it
		controls.minDistance = minDollyDistance(radius)
		const distance = controls.getSpherical(endSpherical, true).radius
		void controls.dollyTo(
			rescaledDistance(distance, previous.radius, radius),
			false,
		)
	}
	return { id: focusId, radius }
}

/**
 * Distance the focus is framed from, scene units: the Sun at 40 radii on the
 * first mount, every other framing at 6 radii. Radii are drawn radii (the
 * active scale's), never true ones.
 */
export const framingDistance = (
	kind: BodyKind,
	radiusUnits: number,
	firstMount: boolean,
): number =>
	(firstMount && kind === "star" ? INITIAL_SUN_RADII : FRAMING_RADII) *
	radiusUnits
