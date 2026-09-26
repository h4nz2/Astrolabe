/**
 * Belts (#23): the asteroid belt and the Kuiper belt as fields of dots, each dot on a real
 * Kepler orbit around the Sun. Not bodies: nothing is named, picked or labelled, and a dot
 * stands for many real members (`Belt.members`). The dots are generated here, once and
 * deterministically (the same belt always gives the same dots), from the zones in
 * src/data/belts.json; the renderer (features/solarSystem/belts) moves them on the GPU with
 * the same Kepler solution `beltDotPositionKm` computes here in doubles.
 *
 * Pure: no React, no three.js.
 */
import type { Belt } from "@/data/schema"

import { DEG_TO_RAD, TWO_PI, solveEccentricAnomaly } from "./kepler"
import { SECONDS_PER_DAY } from "./units"

/** Newton's constant in km^3 / (kg s^2). */
export const G_KM3_PER_KG_S2 = 6.6743e-20

/** Inclinations are |normal(0, sigma)| capped here (degrees), so no dot orbits upside down. */
export const MAX_BELT_INCLINATION_DEG = 60

/** Per-dot orbits, in the layout the GPU attributes use. */
export interface BeltOrbits {
	count: number
	/** per dot: semi-major axis (km), eccentricity, mean motion (rad/day), mean anomaly at J2000 (rad) */
	elements: Float32Array
	/** per dot: unit vector toward periapsis, scene axes */
	periapsis: Float32Array
	/** per dot: unit vector 90 degrees ahead in the orbit plane, scene axes */
	ahead: Float32Array
}

/** A deterministic 32-bit hash of a string (FNV-1a). */
export function hashSeed(text: string): number {
	let h = 0x811c9dc5
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i)
		h = Math.imul(h, 0x01000193)
	}
	return h >>> 0
}

/** mulberry32: a tiny seeded generator of uniform numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
	let s = seed >>> 0
	return () => {
		s = (s + 0x6d2b79f5) >>> 0
		let t = s
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/** How many of a belt's dots each zone gets: its share, the last zone taking the rounding rest. */
export function zoneCounts(belt: Pick<Belt, "dots" | "zones">): number[] {
	let left = belt.dots
	return belt.zones.map((zone, z) => {
		const count =
			z === belt.zones.length - 1
				? left
				: Math.min(left, Math.round(zone.share * belt.dots))
		left -= count
		return count
	})
}

/**
 * The dots of `belt` around a parent of `parentMassKg`: a, e spread uniformly over each zone's
 * ranges (e capped so no orbit comes nearer than the zone's `perihelionMinKm`), inclination
 * |normal(0, sigma)|, node, periapsis and phase uniform.
 */
export function generateBeltOrbits(
	belt: Pick<Belt, "id" | "dots" | "zones">,
	parentMassKg: number,
): BeltOrbits {
	const random = seededRandom(hashSeed(belt.id))
	const gm = G_KM3_PER_KG_S2 * parentMassKg
	const count = belt.dots
	const elements = new Float32Array(count * 4)
	const periapsis = new Float32Array(count * 3)
	const ahead = new Float32Array(count * 3)
	const counts = zoneCounts(belt)
	let k = 0
	belt.zones.forEach((zone, z) => {
		for (let d = 0; d < counts[z]; d++, k++) {
			const [aMin, aMax] = zone.semiMajorAxisKm
			const a = aMin + (aMax - aMin) * random()
			const [eMin, eMaxZone] = zone.eccentricity
			const eMax =
				zone.perihelionMinKm === undefined
					? eMaxZone
					: Math.max(0, Math.min(eMaxZone, 1 - zone.perihelionMinKm / a))
			const e = eMin < eMax ? eMin + (eMax - eMin) * random() : eMax
			// Box-Muller: |normal(0, sigma)|
			const gauss =
				Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(TWO_PI * random())
			const i =
				Math.min(
					Math.abs(gauss) * zone.inclinationSigmaDeg,
					MAX_BELT_INCLINATION_DEG,
				) * DEG_TO_RAD
			const node = TWO_PI * random()
			const peri = TWO_PI * random()
			const m0 = TWO_PI * random()
			const n = Math.sqrt(gm / (a * a * a)) * SECONDS_PER_DAY
			elements.set([a, e, n, m0], k * 4)
			writeOrbitAxes(node, peri, i, periapsis, ahead, k * 3)
		}
	})
	return { count, elements, periapsis, ahead }
}

/**
 * The orbit plane's axes in scene axes (ecliptic (x, y, z) -> scene (x, z, -y)): toward
 * periapsis, and 90 degrees ahead of it in the direction of motion.
 */
function writeOrbitAxes(
	node: number,
	peri: number,
	inc: number,
	p: Float32Array,
	q: Float32Array,
	at: number,
): void {
	const cO = Math.cos(node)
	const sO = Math.sin(node)
	const cw = Math.cos(peri)
	const sw = Math.sin(peri)
	const ci = Math.cos(inc)
	const si = Math.sin(inc)
	const px = cO * cw - sO * sw * ci
	const py = sO * cw + cO * sw * ci
	const pz = sw * si
	const qx = -cO * sw - sO * cw * ci
	const qy = -sO * sw + cO * cw * ci
	const qz = cw * si
	p[at] = px
	p[at + 1] = pz
	p[at + 2] = -py
	q[at] = qx
	q[at + 1] = qz
	q[at + 2] = -qy
}

/**
 * TRUE position (km, scene axes, relative to the parent) of dot `k` at `daysSinceJ2000`,
 * written into `out[at..at + 2]`: the double-precision twin of the belt shader.
 */
export function beltDotPositionKm(
	orbits: BeltOrbits,
	k: number,
	daysSinceJ2000: number,
	out: Float64Array,
	at = 0,
): void {
	const { elements, periapsis, ahead } = orbits
	const a = elements[k * 4]
	const e = elements[k * 4 + 1]
	const n = elements[k * 4 + 2]
	const m0 = elements[k * 4 + 3]
	const E = solveEccentricAnomaly(m0 + n * daysSinceJ2000, e)
	const x = a * (Math.cos(E) - e)
	const y = a * Math.sqrt(1 - e * e) * Math.sin(E)
	for (let c = 0; c < 3; c++) {
		out[at + c] = x * periapsis[k * 3 + c] + y * ahead[k * 3 + c]
	}
}
