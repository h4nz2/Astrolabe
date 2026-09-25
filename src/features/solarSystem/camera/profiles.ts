/**
 * Transit profiles: how a transition moves the camera over normalized time
 * (docs/ARCHITECTURE.md, "Navigation"). A profile only shapes the move; the
 * director supplies the endpoints fresh every frame (both pivots keep
 * orbiting), applies the result and owns interruption, so a new kind of move
 * (#18's three-phase flight, a tour's slow drift) is one more entry here and
 * nothing else. `fly` is that flight (`flightProfile`).
 */
import { FLIGHT_PROFILE, travelledAt } from "@/store/flight"

import {
	clamp01,
	easeInOutCubic,
	zoomPanAt,
	zoomPanLength,
	type ZoomPanSample,
} from "./pose"

export interface TransitInput {
	/** Camera distance at the start and on arrival, scene units. */
	fromDistance: number
	toDistance: number
	/** Current distance between the start pivot and the destination pivot, scene units. */
	separation: number
	/** Visible height per unit of camera distance: 2 tan(fov / 2). */
	widthPerDistance: number
	/** Width over height of the view (1 when unknown). */
	aspect?: number
}

export interface TransitSample {
	/** Weight of the destination pivot (0 = start, 1 = destination). */
	pivot: number
	/** Camera distance from the pivot, scene units. */
	distance: number
	/** Weight of the destination viewing direction. */
	direction: number
	/**
	 * Weight (0..1) of raising the camera to at least `LIFT_ELEVATION_DEG`
	 * above (or below) the plane of the orbits; the rig resets it to 0 before
	 * every sample, so profiles that do not lift leave it alone.
	 */
	lift?: number
}

export interface TransitProfile {
	/** Relative length of the move; the automatic duration grows with it (`transitDurationMs`). */
	length(input: TransitInput): number
	/** The camera at normalized time `t` (0..1). Must start at the start pose and end exactly at the destination. */
	sample(t: number, input: TransitInput, out: TransitSample): TransitSample
	/** The automatic duration, ms; without it the rig derives one from `length` (`transitDurationMs`). */
	durationMs?(input: TransitInput): number
}

const scratch: ZoomPanSample = { u: 0, w: 0 }

/**
 * The default: van Wijk and Nuij's smooth zoom-and-pan in log space, eased in
 * and out. From the overview it descends onto the target while the target is
 * already on screen; between distant bodies it backs out until both are in
 * view, crosses, and descends.
 */
export const smoothProfile: TransitProfile = {
	length: ({ fromDistance, toDistance, separation, widthPerDistance: k }) =>
		zoomPanLength(k * fromDistance, k * toDistance, separation),
	sample(
		t,
		{ fromDistance, toDistance, separation, widthPerDistance: k },
		out,
	) {
		const eased = easeInOutCubic(clamp01(t))
		const w0 = k * fromDistance
		const w1 = k * toDistance
		const length = zoomPanLength(w0, w1, separation)
		zoomPanAt(length * eased, w0, w1, separation, scratch)
		out.pivot =
			separation > 1e-9 * Math.max(w0, w1)
				? clamp01(scratch.u / separation)
				: eased
		out.distance = scratch.w / k
		out.direction = eased
		// exact ends, free of rounding: a move starts where the camera is and ends where it was sent
		if (t <= 0) {
			out.pivot = 0
			out.distance = fromDistance
			out.direction = 0
		} else if (t >= 1) {
			out.pivot = 1
			out.distance = toDistance
			out.direction = 1
		}
		return out
	},
}

// --- the flight between bodies (#18) -----------------------------------------

/**
 * At the top of a flight the narrow side of the view spans this many times
 * the gap between the two bodies: the destination enters the view about a
 * tenth inside its edge while the origin is still near the middle.
 */
export const FLIGHT_TOP_FIT = 2.4
/** Largest share of the flight's time the pull-back, and the descent, may take. */
export const FLIGHT_ZOOM_SHARE = 0.25
/** A zoom of this many e-folds (a factor of about 7) or more takes its full share. */
const FULL_ZOOM_EFOLDS = 2
/** Share of the flight at each end over which the camera rises to, and sinks from, `LIFT_ELEVATION_DEG`. */
const LIFT_SHARE = 0.3
/**
 * During a flight the camera rises to at least this elevation above the plane
 * of the orbits, so the crossing is seen from above and never end-on.
 */
export const LIFT_ELEVATION_DEG = 50
/** A flight lasts between these, ms: a journey, never a jump cut, never a cutscene. */
export const FLIGHT_MIN_MS = 2500
export const FLIGHT_MAX_MS = 5000
const FLIGHT_BASE_MS = 2200
const FLIGHT_MS_PER_EFOLD = 120

/** The shape of one flight: how high it climbs and when each phase runs (normalized time). */
export interface FlightPlan {
	/** Camera distance at the top, scene units. */
	topDistance: number
	/** e-folds of zoom out (pull back) and in (descend). */
	climb: number
	descent: number
	/** The pull-back runs over [0, climbEnd], the descent over [descentStart, 1]. */
	climbEnd: number
	descentStart: number
	/** The pivot crosses the gap over [travelStart, travelEnd], eased in and out. */
	travelStart: number
	travelEnd: number
}

export const createFlightPlan = (): FlightPlan => ({
	topDistance: 1,
	climb: 0,
	descent: 0,
	climbEnd: 0,
	descentStart: 1,
	travelStart: 0,
	travelEnd: 1,
})

/**
 * Plans a flight: high enough that both ends fit the narrow side of the view
 * (`FLIGHT_TOP_FIT`), never lower than either end. The pull-back and the
 * descent get up to a quarter of the time each, in proportion to how far they
 * zoom; the pivot starts crossing halfway up and finishes halfway down, so the
 * three phases flow into one continuous move with most of the crossing done
 * at the top.
 */
export function flightPlan(
	{
		fromDistance,
		toDistance,
		separation,
		widthPerDistance,
		aspect = 1,
	}: TransitInput,
	out: FlightPlan = createFlightPlan(),
): FlightPlan {
	const narrow = widthPerDistance * Math.min(1, aspect)
	out.topDistance = Math.max(
		fromDistance,
		toDistance,
		(FLIGHT_TOP_FIT * separation) / narrow,
	)
	out.climb = Math.log(out.topDistance / fromDistance)
	out.descent = Math.log(out.topDistance / toDistance)
	out.climbEnd = FLIGHT_ZOOM_SHARE * Math.min(1, out.climb / FULL_ZOOM_EFOLDS)
	out.descentStart =
		1 - FLIGHT_ZOOM_SHARE * Math.min(1, out.descent / FULL_ZOOM_EFOLDS)
	out.travelStart = out.climbEnd / 2
	out.travelEnd = (1 + out.descentStart) / 2
	return out
}

const plan = createFlightPlan()

/** From `a` to `b` in log space (distances), by weight `w`. */
const logLerp = (a: number, b: number, w: number): number =>
	a * Math.exp(Math.log(b / a) * w)

/**
 * The flight between two bodies (#18): pull back until both are in view,
 * cross the gap at that height, descend onto the destination. One continuous
 * move: the pivot starts crossing while the camera still climbs and ends
 * while it descends, and the camera rises above the plane of the orbits on
 * the way, so the bodies and orbits it passes slide by beneath it. 2.5-5 s,
 * most of it at the top.
 */
export const flightProfile: TransitProfile = {
	length: (input) => {
		const { climb, descent } = flightPlan(input, plan)
		return climb + descent
	},
	durationMs: (input) => {
		const { climb, descent } = flightPlan(input, plan)
		return Math.min(
			FLIGHT_MAX_MS,
			Math.max(
				FLIGHT_MIN_MS,
				FLIGHT_BASE_MS + FLIGHT_MS_PER_EFOLD * (climb + descent),
			),
		)
	},
	sample(t, input, out) {
		const { fromDistance, toDistance } = input
		const p = flightPlan(input, plan)
		const s = clamp01(t)
		if (s < p.climbEnd) {
			out.distance = logLerp(
				fromDistance,
				p.topDistance,
				easeInOutCubic(s / p.climbEnd),
			)
		} else if (s > p.descentStart) {
			out.distance = logLerp(
				p.topDistance,
				toDistance,
				easeInOutCubic((s - p.descentStart) / (1 - p.descentStart)),
			)
		} else {
			out.distance = p.topDistance
		}
		out.pivot = travelledAt(s, p.travelStart, p.travelEnd)
		out.direction = out.pivot
		out.lift =
			easeInOutCubic(clamp01(s / LIFT_SHARE)) *
			easeInOutCubic(clamp01((1 - s) / LIFT_SHARE))
		if (t <= 0) {
			out.pivot = 0
			out.distance = fromDistance
			out.direction = 0
			out.lift = 0
		} else if (t >= 1) {
			out.pivot = 1
			out.distance = toDistance
			out.direction = 1
			out.lift = 0
		}
		return out
	},
}

export const DEFAULT_PROFILE = "smooth"

/** Every named profile a `ViewRequest.profile` may ask for. */
export const TRANSIT_PROFILES: Readonly<Record<string, TransitProfile>> = {
	smooth: smoothProfile,
	[FLIGHT_PROFILE]: flightProfile,
}

/** The named profile, or the default for null and unknown names. */
export const transitProfile = (name: string | null): TransitProfile =>
	name !== null && Object.hasOwn(TRANSIT_PROFILES, name)
		? TRANSIT_PROFILES[name]
		: TRANSIT_PROFILES[DEFAULT_PROFILE]
