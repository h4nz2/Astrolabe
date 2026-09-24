/**
 * Transit profiles: how a transition moves the camera over normalized time
 * (docs/ARCHITECTURE.md, "Navigation"). A profile only shapes the move; the
 * director supplies the endpoints fresh every frame (both pivots keep
 * orbiting), applies the result and owns interruption, so a new kind of move
 * (#18's three-phase flight, a tour's slow drift) is one more entry here and
 * nothing else.
 */
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
}

export interface TransitSample {
	/** Weight of the destination pivot (0 = start, 1 = destination). */
	pivot: number
	/** Camera distance from the pivot, scene units. */
	distance: number
	/** Weight of the destination viewing direction. */
	direction: number
}

export interface TransitProfile {
	/** Relative length of the move; the automatic duration grows with it (`transitDurationMs`). */
	length(input: TransitInput): number
	/** The camera at normalized time `t` (0..1). Must start at the start pose and end exactly at the destination. */
	sample(t: number, input: TransitInput, out: TransitSample): TransitSample
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

export const DEFAULT_PROFILE = "smooth"

/** Every named profile a `ViewRequest.profile` may ask for. */
export const TRANSIT_PROFILES: Readonly<Record<string, TransitProfile>> = {
	smooth: smoothProfile,
}

/** The named profile, or the default for null and unknown names. */
export const transitProfile = (name: string | null): TransitProfile =>
	name !== null && Object.hasOwn(TRANSIT_PROFILES, name)
		? TRANSIT_PROFILES[name]
		: TRANSIT_PROFILES[DEFAULT_PROFILE]
