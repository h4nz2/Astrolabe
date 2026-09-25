/**
 * The pure half of sound (#32): numbers in, numbers out, no Web Audio. What
 * the ambient bed sounds like at a distance from the Sun, which note a body
 * rings with, how loud a slider position is, and where the camera is in the
 * solar system whatever the scale preset draws.
 */
import { bodies } from "@/data"
import { AU_KM } from "@/sim/units"

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Output gain of the master bus at slider position `volume` (0..1): squared, so the low half stays gentle. */
export const MAX_MASTER_GAIN = 0.6
export const volumeGain = (volume: number): number =>
	MAX_MASTER_GAIN * clamp01(volume) ** 2

/** Distances (AU) that bound the ambient bed: all warmth inside Mercury, all cold at Neptune. */
export const WARM_AU = 0.39
export const COLD_AU = 30
/** Past Neptune the bed keeps thinning out until here. */
export const EMPTY_AU = 1000

export interface AmbientMix {
	/** 0..1: the low, warm drone and the Sun's rumble. */
	warm: number
	/** 0..1: the thin, high, airy layer. */
	cold: number
	/** Low-pass cutoff of the warm drone, Hz: brighter near the Sun. */
	cutoffHz: number
	/** Overall level 0..1: fades toward half past Neptune (thinner). */
	level: number
}

/**
 * The ambient bed at `au` astronomical units from the Sun: warmer near the
 * Sun, thinner and colder out past Neptune. Log-scaled, like the solar system.
 */
export function ambientMix(au: number): AmbientMix {
	const distance = Number.isFinite(au) && au > 0 ? au : 1
	const warmth = clamp01(
		(Math.log10(COLD_AU) - Math.log10(distance)) /
			(Math.log10(COLD_AU) - Math.log10(WARM_AU)),
	)
	const beyond = clamp01(
		(Math.log10(distance) - Math.log10(COLD_AU)) /
			(Math.log10(EMPTY_AU) - Math.log10(COLD_AU)),
	)
	return {
		warm: warmth ** 0.8,
		cold: 1 - warmth,
		cutoffHz: 260 + 640 * warmth,
		level: 1 - 0.5 * beyond,
	}
}

/** One planet's drawn and true distance from the Sun, km. */
export interface DistancePair {
	display: number
	true: number
}

/**
 * The TRUE distance from the Sun that a point drawn `displayKm` from the
 * drawn Sun stands for, read off the planets' drawn and true distances (log
 * interpolation between neighbours, the nearest ratio outside them). At true
 * scale it is the identity; in "Everything visible" a camera hovering at
 * drawn Jupiter is 5.2 AU out, wherever the preset draws Jupiter.
 */
export function equivalentTrueKm(
	displayKm: number,
	pairs: readonly DistancePair[],
): number {
	const usable = pairs
		.filter((pair) => pair.display > 0 && pair.true > 0)
		.sort((a, b) => a.display - b.display)
	if (!(displayKm > 0) || usable.length === 0) return Math.max(0, displayKm)
	const first = usable[0]
	const last = usable[usable.length - 1]
	if (displayKm <= first.display)
		return (displayKm * first.true) / first.display
	if (displayKm >= last.display) return (displayKm * last.true) / last.display
	for (let i = 1; i < usable.length; i++) {
		const b = usable[i]
		if (displayKm > b.display) continue
		const a = usable[i - 1]
		const t =
			(Math.log(displayKm) - Math.log(a.display)) /
			(Math.log(b.display) - Math.log(a.display))
		return Math.exp(
			Math.log(a.true) + t * (Math.log(b.true) - Math.log(a.true)),
		)
	}
	return displayKm
}

export const kmToAu = (km: number): number => km / AU_KM

/**
 * The note a body rings with when the camera arrives or light reaches it: a
 * pentatonic scale falling from Mercury to Neptune (the farther and slower,
 * the deeper), the Sun an octave below, a moon an octave above its planet.
 */
export const PLANET_NOTES_HZ: Readonly<Record<string, number>> = {
	mercury: 880,
	venus: 783.99,
	earth: 659.25,
	mars: 587.33,
	jupiter: 523.25,
	saturn: 440,
	uranus: 392,
	neptune: 329.63,
}
export const SUN_NOTE_HZ = 261.63
const FALLBACK_NOTE_HZ = 523.25

const parentOf = new Map(bodies.map((body) => [body.id, body.parentId]))

export function bodyNoteHz(id: string): number {
	if (id === "sun") return SUN_NOTE_HZ
	const own = PLANET_NOTES_HZ[id]
	if (own !== undefined) return own
	const parent = parentOf.get(id)
	const planet = parent == null ? undefined : PLANET_NOTES_HZ[parent]
	return planet === undefined ? FALLBACK_NOTE_HZ : planet * 2
}

/** Flights shorter than this jumped (reduced motion, a skip): no whoosh. */
export const MIN_WHOOSH_MS = 800

/**
 * The whoosh of a flight (#18) as breakpoints over its normalized time:
 * rising pitch and level while the camera pulls back, a broad rush while it
 * crosses, falling again as it descends. `travelStart`/`travelEnd` are the
 * flight's own crossing window, so the rush peaks while the system slides by.
 */
export interface WhooshPoint {
	/** Normalized time 0..1. */
	t: number
	/** Band-pass centre, Hz. */
	hz: number
	/** Relative level 0..1. */
	gain: number
}

export function whooshShape(
	travelStart: number,
	travelEnd: number,
): WhooshPoint[] {
	const start = clamp01(Number.isFinite(travelStart) ? travelStart : 0.25)
	const end = Math.max(
		start,
		clamp01(Number.isFinite(travelEnd) ? travelEnd : 0.75),
	)
	const mid = (start + end) / 2
	return [
		{ t: 0, hz: 220, gain: 0 },
		{ t: start, hz: 700, gain: 0.6 },
		{ t: mid, hz: 1100, gain: 1 },
		{ t: end, hz: 800, gain: 0.6 },
		{ t: 1, hz: 200, gain: 0 },
	]
}
