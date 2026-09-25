/**
 * What is in the sky tonight (#36): which planets and the Moon a person
 * standing outside at a place can see tonight, when, where, how bright and
 * with what. Pure (no React, no strings): times are epoch milliseconds,
 * angles degrees; the words are built in `text.ts`.
 *
 * The astronomy is astronomy-engine's (VSOP87 planets, a full lunar theory,
 * precession and nutation to the equator of date, aberration, topocentric
 * parallax, atmospheric refraction, visual magnitudes). The simulation's own
 * Kepler model is exact enough to draw the planets (0.1 deg in 2025-2030) but
 * leaves the Moon up to 2.4 deg out (no evection or variation), which is
 * a quarter of an hour on a moonrise: not good enough for a real evening
 * outdoors. See docs/ARCHITECTURE.md, "Sky tonight".
 */
import {
	Body as AstroBody,
	Elongation,
	Equator,
	Horizon,
	Illumination,
	MakeTime,
	MoonPhase,
	Observer,
	SearchMoonPhase,
	SearchRiseSet,
	type AstroTime,
} from "astronomy-engine"

import { PHASE_IDS, type Phase } from "../frame/sky"

/** The bodies the list covers, in the order it shows them. */
export const SKY_BODY_IDS = [
	"moon",
	"venus",
	"jupiter",
	"mars",
	"saturn",
	"mercury",
	"uranus",
	"neptune",
] as const
export type SkyBodyId = (typeof SKY_BODY_IDS)[number]

const ASTRO_BODY: Readonly<Record<SkyBodyId | "sun", AstroBody>> = {
	sun: AstroBody.Sun,
	moon: AstroBody.Moon,
	mercury: AstroBody.Mercury,
	venus: AstroBody.Venus,
	mars: AstroBody.Mars,
	jupiter: AstroBody.Jupiter,
	saturn: AstroBody.Saturn,
	uranus: AstroBody.Uranus,
	neptune: AstroBody.Neptune,
}

/** Where the observer stands. Coordinates in degrees (north and east positive). */
export interface SkyPlace {
	readonly latitude: number
	readonly longitude: number
	/** IANA time zone the times are shown in ("Europe/Zurich"). */
	readonly timeZone: string
}

/** The eight compass points, clockwise from north. */
export const COMPASS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const
export type Compass = (typeof COMPASS)[number]

/** How high up, in words: low (under 20 deg), partway, high, nearly overhead (75 deg and more). */
export type Height = "low" | "mid" | "high" | "overhead"

/** What you need to see it. */
export type Aid = "eyes" | "binoculars" | "telescope"

/** How bright, from the visual magnitude. */
export type Brightness =
	"dazzling" | "veryBright" | "bright" | "medium" | "faint" | "veryFaint"

/** Why a body cannot be seen tonight. */
export type HiddenReason =
	/** Too close to the Sun in the sky: lost in its glare. */
	| "sunGlare"
	/** Near the Sun's side of the sky: it sets soon after the Sun (evening) or rises just before it (morning). */
	| "twilight"
	/** Up at night, but the sky never gets dark enough (a white night). */
	| "brightSky"
	/** Above the horizon only while the Sun is up. */
	| "daytime"

/** Where a body is at one instant, as seen from the place. */
export interface SkyPosition {
	/** Epoch milliseconds. */
	readonly ms: number
	/** Altitude above the horizon (refracted, as it appears), degrees. */
	readonly altitude: number
	/** Azimuth, degrees clockwise from north (90 = east). */
	readonly azimuth: number
}

export interface Sighting {
	readonly id: SkyBodyId
	/** Visible some time tonight. */
	readonly visible: boolean
	/** Visibility window (epoch ms); only meaningful while `visible`. */
	readonly from: number
	readonly until: number
	/** Already visible as soon as the sky is dark enough for it (it does not rise later). */
	readonly fromDusk: boolean
	/** Still visible when dawn washes it out (it does not set earlier). */
	readonly untilDawn: boolean
	/** Where it is when it can first be seen. */
	readonly first: SkyPosition
	/** Where it is at its highest while visible. */
	readonly best: SkyPosition
	/** Visual magnitude (smaller is brighter; the brightest stars are about 0). */
	readonly magnitude: number
	readonly brightness: Brightness
	readonly aid: Aid
	/** Angle from the Sun in the sky, degrees (at the first sighting, else mid-night). */
	readonly elongation: number
	/** East of the Sun (an evening object) or west of it (a morning object). */
	readonly side: "evening" | "morning"
	readonly reason: HiddenReason | null
}

export interface MoonTonight {
	readonly phase: Phase
	/** Next full moon and next new moon after `now` (epoch ms). */
	readonly nextFull: number
	readonly nextNew: number
}

export type NightKind =
	/** The Sun sets and rises again: the usual night. */
	| "night"
	/** The Sun does not set in the next day (summer near the poles). */
	| "midnightSun"
	/** The Sun does not rise in the next day (winter near the poles). */
	| "polarNight"

export interface SkyTonight {
	readonly kind: NightKind
	/** The night's limits (epoch ms): sunset to sunrise, or the next 24 hours in a polar night. */
	readonly start: number
	readonly end: number
	/** Sunset and sunrise, when they happen. */
	readonly sunset: number | null
	readonly sunrise: number | null
	/** The Sun 6 degrees below the horizon (end of civil twilight) in the evening and morning, if it gets that low. */
	readonly dusk: number | null
	readonly dawn: number | null
	/** Every body of SKY_BODY_IDS, visible first (in list order), then the hidden ones. */
	readonly sightings: readonly Sighting[]
	readonly moon: MoonTonight
}

/** Why a body that is never seen tonight is hidden, from its angle from the Sun. */
export function hiddenReason(
	elongation: number,
	upAtNight: boolean,
): HiddenReason {
	if (elongation < 20) return "sunGlare"
	if (upAtNight) return "brightSky"
	if (elongation < 50) return "twilight"
	return "daytime"
}

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000
/** Sampling step over the night; window edges are then refined to a minute. */
const STEP_MS = 10 * MINUTE_MS
/** The Sun's upper limb on the horizon, with refraction: the standard sunset altitude. */
const SUNSET_ALTITUDE = -0.833
const CIVIL_TWILIGHT = -6

/** Lowest altitude a body counts as visible at: trees and houses hide the last few degrees. */
export const minAltitude = (id: SkyBodyId): number => (id === "moon" ? 1 : 5)

/**
 * How low the Sun must be before a body of `magnitude` stands out: Venus
 * shows right after sunset, Saturn needs the end of civil twilight, Uranus
 * a properly dark sky. The Moon only needs the Sun set.
 */
export function sunLimit(id: SkyBodyId, magnitude: number): number {
	if (id === "moon") return SUNSET_ALTITUDE
	if (magnitude <= -3) return -3
	if (magnitude <= -1) return -5
	if (magnitude <= 1) return -7
	if (magnitude <= 3) return -9
	return -12
}

/** Naked eye up to magnitude 4.5 (a town sky), binoculars to 7.5, else a telescope. */
export function aidFor(magnitude: number): Aid {
	if (magnitude <= 4.5) return "eyes"
	if (magnitude <= 7.5) return "binoculars"
	return "telescope"
}

export function brightnessOf(magnitude: number): Brightness {
	if (magnitude <= -3) return "dazzling"
	if (magnitude <= -1.5) return "veryBright"
	if (magnitude <= 0.5) return "bright"
	if (magnitude <= 2) return "medium"
	if (magnitude <= 7.5) return "faint"
	return "veryFaint"
}

/** Azimuth (degrees from north, clockwise) to the nearest of eight compass points. */
export function compassOf(azimuth: number): Compass {
	const k = Math.round((((azimuth % 360) + 360) % 360) / 45) % 8
	return COMPASS[k]
}

export function heightOf(altitude: number): Height {
	if (altitude < 20) return "low"
	if (altitude < 50) return "mid"
	if (altitude < 75) return "high"
	return "overhead"
}

/** A fist held at arm's length covers about 10 degrees: the altitude in fists, at least one. */
export const fistsOf = (altitude: number): number =>
	Math.max(1, Math.round(altitude / 10))

interface Sample {
	ms: number
	sun: number
	altitude: Float64Array
	azimuth: Float64Array
}

/**
 * Altitude and azimuth of `body`. Bodies get the refraction the eye sees;
 * the Sun's altitude stays geometric, because sunset (-0.833 deg) and
 * twilight (-6 deg) are defined on the geometric altitude.
 */
function horizontal(
	body: AstroBody,
	time: AstroTime,
	observer: Observer,
): { altitude: number; azimuth: number } {
	const equ = Equator(body, time, observer, true, true)
	const hor = Horizon(
		time,
		observer,
		equ.ra,
		equ.dec,
		body === AstroBody.Sun ? undefined : "normal",
	)
	return { altitude: hor.altitude, azimuth: hor.azimuth }
}

const sunAltitude = (ms: number, observer: Observer): number =>
	horizontal(AstroBody.Sun, MakeTime(new Date(ms)), observer).altitude

function sample(ms: number, observer: Observer): Sample {
	const time = MakeTime(new Date(ms))
	const altitude = new Float64Array(SKY_BODY_IDS.length)
	const azimuth = new Float64Array(SKY_BODY_IDS.length)
	SKY_BODY_IDS.forEach((id, k) => {
		const h = horizontal(ASTRO_BODY[id], time, observer)
		altitude[k] = h.altitude
		azimuth[k] = h.azimuth
	})
	return {
		ms,
		sun: horizontal(AstroBody.Sun, time, observer).altitude,
		altitude,
		azimuth,
	}
}

const riseSet = (
	observer: Observer,
	direction: 1 | -1,
	fromMs: number,
	limitDays: number,
): number | null =>
	SearchRiseSet(
		AstroBody.Sun,
		observer,
		direction,
		new Date(fromMs),
		limitDays,
	)?.date.getTime() ?? null

/**
 * The night to show at `nowMs`: the one going on (the Sun is down), else the
 * coming one. Near the poles, the next 24 hours without a sunset or sunrise.
 */
export function nightAround(
	place: SkyPlace,
	nowMs: number,
): Pick<SkyTonight, "kind" | "start" | "end" | "sunset" | "sunrise"> {
	const observer = new Observer(place.latitude, place.longitude, 0)
	const sunUp = sunAltitude(nowMs, observer) > SUNSET_ALTITUDE
	const sunset = sunUp
		? riseSet(observer, -1, nowMs, 1)
		: riseSet(observer, -1, nowMs, -1)
	if (sunset === null) {
		return sunUp
			? {
					kind: "midnightSun",
					start: nowMs,
					end: nowMs + DAY_MS,
					sunset: null,
					sunrise: null,
				}
			: polarNight(observer, nowMs)
	}
	const sunrise = riseSet(observer, 1, sunset, 1.2)
	if (sunrise === null) return polarNight(observer, sunset, sunset)
	return { kind: "night", start: sunset, end: sunrise, sunset, sunrise }
}

function polarNight(
	observer: Observer,
	startMs: number,
	sunset: number | null = null,
): Pick<SkyTonight, "kind" | "start" | "end" | "sunset" | "sunrise"> {
	const sunrise = riseSet(observer, 1, startMs, 1)
	return {
		kind: sunrise === null ? "polarNight" : "night",
		start: startMs,
		end: sunrise ?? startMs + DAY_MS,
		sunset,
		sunrise,
	}
}

/** The first instant (to a minute) in (a, b] where `test` flips from `test(a)`. */
function edge(a: number, b: number, test: (ms: number) => boolean): number {
	const start = test(a)
	let lo = a
	let hi = b
	while (hi - lo > MINUTE_MS) {
		const mid = (lo + hi) / 2
		if (test(mid) === start) lo = mid
		else hi = mid
	}
	return hi
}

function positionAt(
	id: SkyBodyId,
	ms: number,
	observer: Observer,
): SkyPosition {
	const h = horizontal(ASTRO_BODY[id], MakeTime(new Date(ms)), observer)
	return { ms, altitude: h.altitude, azimuth: h.azimuth }
}

/** Where `id` (or the Sun, geometric altitude) stands in the sky of `place` at `ms`. */
export function skyPosition(
	id: SkyBodyId | "sun",
	place: SkyPlace,
	ms: number,
): SkyPosition {
	const observer = new Observer(place.latitude, place.longitude, 0)
	const h = horizontal(ASTRO_BODY[id], MakeTime(new Date(ms)), observer)
	return { ms, altitude: h.altitude, azimuth: h.azimuth }
}

/** The Moon's phase at `ms`, in the terms of #31's phase disc (frame/sky.ts). */
export function moonPhaseAt(ms: number): Phase {
	const date = new Date(ms)
	const elongation = MoonPhase(date)
	const illumination = Illumination(AstroBody.Moon, date)
	return {
		id: PHASE_IDS[Math.floor(((elongation + 22.5) % 360) / 45)],
		fraction: illumination.phase_fraction,
		phaseAngleDeg: illumination.phase_angle,
		waxing: elongation < 180,
	}
}

function sighting(
	id: SkyBodyId,
	k: number,
	samples: readonly Sample[],
	observer: Observer,
	night: Pick<SkyTonight, "start" | "end">,
): Sighting {
	const mid = (night.start + night.end) / 2
	const magnitude = Illumination(ASTRO_BODY[id], new Date(mid)).mag
	const minAlt = minAltitude(id)
	const sunMax = sunLimit(id, magnitude)
	const seen = (s: Sample) => s.altitude[k] >= minAlt && s.sun <= sunMax
	const seenAt = (ms: number) => {
		const time = MakeTime(new Date(ms))
		return (
			horizontal(ASTRO_BODY[id], time, observer).altitude >= minAlt &&
			horizontal(AstroBody.Sun, time, observer).altitude <= sunMax
		)
	}

	// the longest run of visible samples (a body is almost always seen in one stretch)
	let bestRun: [number, number] | null = null
	let runStart = -1
	samples.forEach((s, i) => {
		if (seen(s)) {
			if (runStart < 0) runStart = i
			const run: [number, number] = [runStart, i]
			if (bestRun === null || run[1] - run[0] > bestRun[1] - bestRun[0])
				bestRun = run
		} else runStart = -1
	})

	const elongationAt = (ms: number) => {
		const e = Elongation(ASTRO_BODY[id], new Date(ms))
		return {
			elongation: e.elongation,
			side: e.visibility === "evening" ? "evening" : "morning",
		} as const
	}

	if (bestRun === null) {
		const upAtNight = samples.some(
			(s) => s.altitude[k] >= minAlt && s.sun <= SUNSET_ALTITUDE,
		)
		const { elongation, side } = elongationAt(mid)
		const reason = hiddenReason(elongation, upAtNight)
		const here = positionAt(id, mid, observer)
		return {
			id,
			visible: false,
			from: mid,
			until: mid,
			fromDusk: false,
			untilDawn: false,
			first: here,
			best: here,
			magnitude,
			brightness: brightnessOf(magnitude),
			aid: aidFor(magnitude),
			elongation,
			side,
			reason,
		}
	}

	const [i0, i1] = bestRun as [number, number]
	const fromDusk =
		i0 === 0 ||
		(samples[i0 - 1].altitude[k] >= minAlt && samples[i0 - 1].sun > sunMax)
	const untilDawn =
		i1 === samples.length - 1 ||
		(samples[i1 + 1].altitude[k] >= minAlt && samples[i1 + 1].sun > sunMax)
	const from =
		i0 === 0 ? samples[0].ms : edge(samples[i0 - 1].ms, samples[i0].ms, seenAt)
	const until =
		i1 === samples.length - 1
			? samples[i1].ms
			: edge(samples[i1].ms, samples[i1 + 1].ms, seenAt) - MINUTE_MS

	let top = i0
	for (let i = i0; i <= i1; i++) {
		if (samples[i].altitude[k] > samples[top].altitude[k]) top = i
	}
	const first = positionAt(id, from, observer)
	const best =
		samples[top].altitude[k] > first.altitude
			? {
					ms: samples[top].ms,
					altitude: samples[top].altitude[k],
					azimuth: samples[top].azimuth[k],
				}
			: first
	const { elongation, side } = elongationAt(from)
	return {
		id,
		visible: true,
		from,
		until: Math.max(from, until),
		fromDusk,
		untilDawn,
		first,
		best,
		magnitude,
		brightness: brightnessOf(magnitude),
		aid: aidFor(magnitude),
		elongation,
		side,
		reason: null,
	}
}

/**
 * Tonight's sky at `place`, for the night going on at `nowMs` or the next one
 * (the wall clock, not the simulation clock: this is about going outside).
 */
export function skyTonight(place: SkyPlace, nowMs: number): SkyTonight {
	const observer = new Observer(place.latitude, place.longitude, 0)
	const night = nightAround(place, nowMs)

	const samples: Sample[] = []
	if (night.kind !== "midnightSun") {
		for (let ms = night.start; ms < night.end; ms += STEP_MS) {
			samples.push(sample(ms, observer))
		}
		samples.push(sample(night.end, observer))
	}

	// civil dusk and dawn from the samples, refined to a minute
	let dusk: number | null = null
	let dawn: number | null = null
	const dark = (ms: number) => sunAltitude(ms, observer) <= CIVIL_TWILIGHT
	for (let i = 1; i < samples.length; i++) {
		const was = samples[i - 1].sun <= CIVIL_TWILIGHT
		const is = samples[i].sun <= CIVIL_TWILIGHT
		if (!was && is && dusk === null)
			dusk = edge(samples[i - 1].ms, samples[i].ms, dark)
		if (was && !is) dawn = edge(samples[i - 1].ms, samples[i].ms, dark)
	}

	const sightings = SKY_BODY_IDS.map((id, k) =>
		samples.length === 0
			? hiddenAllNight(id, night, observer)
			: sighting(id, k, samples, observer, night),
	)
	const now = new Date(nowMs)
	return {
		...night,
		dusk,
		dawn,
		sightings: [
			...sightings.filter((s) => s.visible),
			...sightings.filter((s) => !s.visible),
		],
		moon: {
			phase: moonPhaseAt(
				night.kind === "night" ? (dusk ?? night.start) : nowMs,
			),
			nextFull: SearchMoonPhase(180, now, 40)?.date.getTime() ?? Number.NaN,
			nextNew: SearchMoonPhase(0, now, 40)?.date.getTime() ?? Number.NaN,
		},
	}
}

/** Under the midnight sun nothing but the Moon could be seen, and the list says why. */
function hiddenAllNight(
	id: SkyBodyId,
	night: Pick<SkyTonight, "start" | "end">,
	observer: Observer,
): Sighting {
	const mid = (night.start + night.end) / 2
	const magnitude = Illumination(ASTRO_BODY[id], new Date(mid)).mag
	const e = Elongation(ASTRO_BODY[id], new Date(mid))
	const here = positionAt(id, mid, observer)
	return {
		id,
		visible: false,
		from: mid,
		until: mid,
		fromDusk: false,
		untilDawn: false,
		first: here,
		best: here,
		magnitude,
		brightness: brightnessOf(magnitude),
		aid: aidFor(magnitude),
		elongation: e.elongation,
		side: e.visibility === "evening" ? "evening" : "morning",
		reason: hiddenReason(e.elongation, true),
	}
}
