/**
 * Pure camera math for the director (docs/ARCHITECTURE.md, "Camera"): the
 * spherical camera pose around the pivot, conversions to and from the
 * scale-free `CameraShot` of the navigation model, angle blending, and the
 * smooth zoom-and-pan path transits follow. No React, no three.js objects.
 */
import { degToRad, radToDeg } from "@/sim"
import type { CameraShot } from "@/store/navigation"

/**
 * The camera around its pivot in camera-controls' convention (Y up): `theta`
 * is the azimuth about +Y (0 = on +Z), `phi` the polar angle from +Y.
 */
export interface SphericalPose {
	radius: number
	theta: number
	phi: number
}

export const createPose = (): SphericalPose => ({
	radius: 1,
	theta: 0,
	phi: Math.PI / 2,
})

export const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t)

/** Cubic ease-in-out on [0, 1]. */
export const easeInOutCubic = (t: number): number =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

/** `angle` wrapped into [-pi, pi). */
export const wrapPi = (angle: number): number =>
	angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI))

/** From `a` toward `b` the short way round, by weight `w`. */
export const lerpAngle = (a: number, b: number, w: number): number =>
	a + wrapPi(b - a) * w

export const isFinitePose = (pose: SphericalPose): boolean =>
	Number.isFinite(pose.radius) &&
	pose.radius > 0 &&
	Number.isFinite(pose.theta) &&
	Number.isFinite(pose.phi)

/** The pose a complete shot describes, `defaultDistance` being the view's `distance: 1`. */
export function shotToPose(
	shot: CameraShot,
	defaultDistance: number,
	out: SphericalPose,
): SphericalPose {
	out.radius = shot.distance * defaultDistance
	out.theta = degToRad(shot.azimuthDeg)
	out.phi = degToRad(90 - shot.elevationDeg)
	return out
}

/** The shot of a pose, relative to the view's default distance. */
export const poseToShot = (
	pose: SphericalPose,
	defaultDistance: number,
): CameraShot => ({
	azimuthDeg: radToDeg(pose.theta),
	elevationDeg: 90 - radToDeg(pose.phi),
	distance: pose.radius / defaultDistance,
})

/**
 * The arrival pose of a request: the requested angles, or the current viewing
 * direction where the request leaves them out; the requested distance, or the
 * default framing (1x).
 */
export function resolveShot(
	requested: Partial<CameraShot> | null,
	current: SphericalPose,
	defaultDistance: number,
	out: SphericalPose,
): SphericalPose {
	out.theta =
		requested?.azimuthDeg === undefined
			? current.theta
			: degToRad(requested.azimuthDeg)
	out.phi =
		requested?.elevationDeg === undefined
			? current.phi
			: degToRad(90 - requested.elevationDeg)
	out.radius = (requested?.distance ?? 1) * defaultDistance
	return out
}

/**
 * Curvature of the zoom-and-pan path: how far it backs out. van Wijk and Nuij
 * found about sqrt(2) the most comfortable; at sqrt(2) the top of a long trip
 * shows the two ends exactly at the edges of the view (the view height equals
 * the trip), at 1.6 they sit about a fifth inside it, so both stay visible.
 */
export const ZOOM_PAN_RHO = 1.6

export interface ZoomPanSample {
	/** Distance travelled along the line between the two pivots (0..d). */
	u: number
	/** View width at that point. */
	w: number
}

const isPureZoom = (w0: number, w1: number, d: number): boolean =>
	!(d > 1e-9 * Math.max(w0, w1))

/**
 * Length of the optimal zoom-and-pan path from view width `w0` to `w1` over a
 * pan of `d` (van Wijk and Nuij 2003, "Smooth and efficient zooming and
 * panning"), in its own dimensionless units: about the number of e-folds of
 * zoom the move takes. Far moves back out until both ends are in view, then
 * travel, then descend; short ones blend pan and zoom.
 */
export function zoomPanLength(
	w0: number,
	w1: number,
	d: number,
	rho: number = ZOOM_PAN_RHO,
): number {
	if (isPureZoom(w0, w1, d)) return Math.abs(Math.log(w1 / w0)) / rho
	const rho2 = rho * rho
	const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * d * d) / (2 * w0 * rho2 * d)
	const b1 = (w1 * w1 - w0 * w0 - rho2 * rho2 * d * d) / (2 * w1 * rho2 * d)
	// r = ln(-b + sqrt(b^2 + 1)) = -asinh(b), stable for large |b|
	return (Math.asinh(b0) - Math.asinh(b1)) / rho
}

/** The point at path length `s` (0..`zoomPanLength`) of the path above. */
export function zoomPanAt(
	s: number,
	w0: number,
	w1: number,
	d: number,
	out: ZoomPanSample,
	rho: number = ZOOM_PAN_RHO,
): ZoomPanSample {
	if (isPureZoom(w0, w1, d)) {
		out.u = 0
		out.w = w0 * Math.exp(Math.sign(Math.log(w1 / w0)) * rho * s)
		return out
	}
	const rho2 = rho * rho
	const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * d * d) / (2 * w0 * rho2 * d)
	const r0 = -Math.asinh(b0)
	const x = rho * s + r0
	out.u = (w0 / rho2) * (Math.cosh(r0) * Math.tanh(x) - Math.sinh(r0))
	out.w = (w0 * Math.cosh(r0)) / Math.cosh(x)
	return out
}

/** Transits never take less or more than this, ms (a jump is an explicit `durationMs: 0`). */
export const MIN_TRANSIT_MS = 800
export const MAX_TRANSIT_MS = 3000

/**
 * The automatic duration of a move of `length` (see `zoomPanLength`): about
 * 1.1 s from the overview down to a planet, 2.5 s between the far planets.
 * Flights between bodies (#18) have their own (`flightProfile.durationMs`).
 */
export const transitDurationMs = (length: number): number =>
	length < 1e-6
		? 0
		: Math.min(MAX_TRANSIT_MS, Math.max(MIN_TRANSIT_MS, 400 + 120 * length))
