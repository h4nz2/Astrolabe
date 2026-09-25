/**
 * The opening sequence (#30, docs/ARCHITECTURE.md, "The first ten seconds"):
 * what the camera does, beat by beat, as a plain `playSequence` script.
 *
 * Close on Earth, in true scale, then pull back: the Moon, the inner planets,
 * the whole system, until Earth is far below a pixel and the screen is mostly
 * empty. The last beat switches the scale to Everything visible (the app's
 * default), so the sequence hands over in exactly the view a reset leads to.
 * Pure: no store, no DOM, so the timing and the shots are unit-tested.
 */
import { bodyById } from "@/data"
import { propagate, radToDeg, type ScalePresetId } from "@/sim"
import {
	HOME_SHOT,
	OVERVIEW,
	type SequenceStep,
	type View,
} from "@/store/navigation"
import { simSearchSchema, type SimSearch } from "@/store/simSearch"

/** The beats, in order; each is one step of the sequence and one caption. */
export const INTRO_BEATS = [
	"earth",
	"moon",
	"inner",
	"system",
	"scale",
] as const
export type IntroBeat = (typeof INTRO_BEATS)[number]

/** The scale the pull-back is drawn in: nothing enlarged, nothing squeezed. */
export const INTRO_SCALE: ScalePresetId = "trueScale"
/** The scale the last beat switches to and the sequence hands over in (the app's default). */
export const HANDOVER_SCALE: ScalePresetId = "everythingVisible"
/** The beat at whose start the scale switches to `HANDOVER_SCALE`. */
export const SCALE_BEAT = INTRO_BEATS.indexOf("scale")

/** Length of the animated switch to Everything visible in the last beat, ms. */
export const SCALE_REVEAL_MS = 2000

/** Hard ceiling for the whole opening, ms (the issue: "under fifteen seconds"). */
export const INTRO_MAX_MS = 15_000

/**
 * How far the close-up turns away from the Sun (degrees of azimuth): Earth is
 * mostly lit with its terminator in view, never the night side.
 */
export const EARTH_PHASE_DEG = 35

interface BeatTiming {
	/** The move into the beat, ms (0: a cut). */
	moveMs: number
	/** The time on the beat after arriving, ms. */
	holdMs: number
}

/** The animated opening: 14 s. */
const MOTION: Record<IntroBeat, BeatTiming> = {
	earth: { moveMs: 0, holdMs: 1600 },
	moon: { moveMs: 2000, holdMs: 900 },
	inner: { moveMs: 2400, holdMs: 900 },
	system: { moveMs: 2200, holdMs: 1400 },
	scale: { moveMs: 0, holdMs: SCALE_REVEAL_MS + 600 },
}

/**
 * With reduced motion asked for: the same shots as cuts, each held a little
 * longer so its caption can be read; the scale switch is a cut as well.
 */
const STILL: Record<IntroBeat, BeatTiming> = {
	earth: { moveMs: 0, holdMs: 2200 },
	moon: { moveMs: 0, holdMs: 2200 },
	inner: { moveMs: 0, holdMs: 2200 },
	system: { moveMs: 0, holdMs: 2600 },
	scale: { moveMs: 0, holdMs: 2600 },
}

export interface IntroOptions {
	/** Azimuth (degrees) from which Earth is seen lit, see `sunlitAzimuthDeg`. */
	earthAzimuthDeg: number
	reducedMotion: boolean
}

const earth = bodyById.get("earth")
const moon = bodyById.get("moon")

/** The Moon's mean distance from Earth, true km. */
export const MOON_DISTANCE_KM = moon?.orbit?.semiMajorAxisKm ?? 384_400

/** The Earth-Moon shot frames a sphere this much larger than the Moon's orbit. */
const MOON_FIT_MARGIN = 1.25
/** The inner-planets shot frames a sphere of this radius around the Sun, in TRUE km (1.8 AU: Mars and a margin). */
export const INNER_FIT_KM = 1.8 * 149_597_870.7

/** An angle in [-180, 180), degrees. */
const wrapDeg = (deg: number): number =>
	((((deg + 180) % 360) + 360) % 360) - 180

/** Azimuth `a` moved a share `w` of the shorter way toward `b`, degrees. */
export const turnToward = (a: number, b: number, w: number): number =>
	wrapDeg(a + wrapDeg(b - a) * w)

/**
 * The camera azimuth (degrees, camera-controls: 0 = scene +Z) from which Earth
 * at Julian Date `jd` is seen from the Sun's side, turned `EARTH_PHASE_DEG`
 * away, so the close-up shows a mostly lit globe on any date.
 */
export function sunlitAzimuthDeg(jd: number): number {
	if (earth?.orbit == null) return HOME_SHOT.azimuthDeg
	const p = propagate(earth.orbit, jd)
	// Earth -> Sun is -p; camera-controls puts azimuth theta at (sin theta, ., cos theta)
	const towardSun = radToDeg(Math.atan2(-p.x, -p.z))
	return wrapDeg(towardSun + EARTH_PHASE_DEG)
}

/**
 * The opening as a camera sequence. The azimuth turns from the sunlit side of
 * Earth to the overview's home direction over the pull-back, so the sequence
 * ends exactly on the overview a reset shows.
 */
export function introSteps({
	earthAzimuthDeg,
	reducedMotion,
}: IntroOptions): SequenceStep[] {
	const timing = reducedMotion ? STILL : MOTION
	const earthView: View = { kind: "body", id: "earth" }
	const az = (share: number) =>
		turnToward(earthAzimuthDeg, HOME_SHOT.azimuthDeg, share)
	const step = (beat: IntroBeat, rest: Omit<SequenceStep, "holdMs">) => ({
		...rest,
		durationMs: timing[beat].moveMs,
		holdMs: timing[beat].holdMs,
	})
	return [
		step("earth", {
			view: earthView,
			shot: { azimuthDeg: az(0), elevationDeg: 12, distance: 0.85 },
		}),
		step("moon", {
			view: earthView,
			shot: { azimuthDeg: az(0.15), elevationDeg: 28 },
			fit: { km: MOON_DISTANCE_KM * MOON_FIT_MARGIN, around: "earth" },
		}),
		step("inner", {
			view: OVERVIEW,
			shot: { azimuthDeg: az(0.55), elevationDeg: 55 },
			fit: { km: INNER_FIT_KM, around: "sun" },
		}),
		step("system", { view: OVERVIEW, shot: HOME_SHOT }),
		step("scale", { view: OVERVIEW, shot: HOME_SHOT }),
	]
}

/** Total length of a sequence of steps with explicit moves and holds, ms. */
export const sequenceLengthMs = (steps: readonly SequenceStep[]): number =>
	steps.reduce(
		(total, step) => total + (step.durationMs ?? 0) + (step.holdMs ?? 0),
		0,
	)

/** Start time of each beat within the opening, ms (for the progress bar). */
export const beatStartsMs = (steps: readonly SequenceStep[]): number[] => {
	let at = 0
	return steps.map((step) => {
		const start = at
		at += (step.durationMs ?? 0) + (step.holdMs ?? 0)
		return start
	})
}

/** The simulation search params (everything but `lang` and `reading`). */
const SIM_PARAMS = Object.keys(simSearchSchema.shape) as (keyof SimSearch)[]

/**
 * True when a link says where to look (a body, a camera, a time, a scale, a
 * layer, a panel, a mode): it opens exactly there and the opening never plays
 * over it. Only the language and the reading level (on every URL) don't count.
 */
export const hasExplicitView = (search: Partial<SimSearch>): boolean =>
	SIM_PARAMS.some((param) => search[param] !== undefined)
