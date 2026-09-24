/**
 * Sunlight (issue #22): the one model of how a body is lit. The Sun (the root
 * body) is the only light source; everything here works in TRUE kilometres
 * (`positionsKm`, `radiusKm`), never in display space, so the terminator,
 * phases and eclipses are the real ones in every scale preset.
 *
 * The renderer (src/features/solarSystem/lighting) feeds the same quantities
 * to a shader that mirrors `sunVisibleFraction` per pixel: a surface point of
 * the drawn sphere maps to the true surface point in the same direction from
 * the body's centre, so a real shadow lands on the same spot of the drawn
 * globe however much the scale engine enlarges it. See docs/ARCHITECTURE.md,
 * "Lighting".
 *
 * Pure: no React, no three.js; allocation-free on the per-frame paths.
 */
import type { WritableVec3 } from "./positions"

/** Shadow casters handed to the shader per receiving body. */
export const MAX_OCCLUDERS = 4

/** Floats per occluder in the packed array: x, y, z (km, relative to the receiver's centre), radius (km). */
export const OCCLUDER_STRIDE = 4

/** The subset of a `Body` lighting needs. */
export interface LitBody {
	readonly id: string
	readonly parentId: string | null
	readonly radiusKm: number
}

/**
 * Area of the intersection of two discs with radii `a` and `b` whose centres
 * are `c` apart (any unit; angles in radians for the Sun and an occluder seen
 * from a surface point). Exact circle-circle lens formula.
 */
export function discOverlapArea(a: number, b: number, c: number): number {
	if (a <= 0 || b <= 0) return 0
	if (c >= a + b) return 0
	const small = Math.min(a, b)
	if (c <= Math.abs(a - b)) return Math.PI * small * small
	const a2 = a * a
	const b2 = b * b
	const c2 = c * c
	const alpha = Math.acos(clamp((c2 + a2 - b2) / (2 * c * a), -1, 1))
	const beta = Math.acos(clamp((c2 + b2 - a2) / (2 * c * b), -1, 1))
	const kite = (-c + a + b) * (c + a - b) * (c - a + b) * (c + a + b)
	return a2 * alpha + b2 * beta - 0.5 * Math.sqrt(Math.max(kite, 0))
}

const clamp = (x: number, lo: number, hi: number): number =>
	x < lo ? lo : x > hi ? hi : x

/**
 * Angle in radians between the directions of two vectors, from the chord of
 * their unit vectors: accurate for the tiny angles eclipses are made of
 * (an acos of a dot product is not, in float32 or near 1).
 */
export function angleBetween(
	ax: number,
	ay: number,
	az: number,
	bx: number,
	by: number,
	bz: number,
): number {
	const la = Math.hypot(ax, ay, az)
	const lb = Math.hypot(bx, by, bz)
	if (la === 0 || lb === 0) return 0
	const chord = Math.hypot(
		ax / la - bx / lb,
		ay / la - by / lb,
		az / la - bz / lb,
	)
	return 2 * Math.asin(Math.min(chord / 2, 1))
}

/**
 * Fraction of the Sun's disc visible from point `p` (0 = umbra, 1 = full
 * sunlight, in between = penumbra or an annular eclipse). All vectors are
 * relative to the receiving body's centre in true km:
 *
 * @param px,py,pz  the surface point
 * @param sx,sy,sz  the Sun's centre
 * @param sunRadiusKm the Sun's radius
 * @param occluders packed `MAX_OCCLUDERS * OCCLUDER_STRIDE` floats: centre xyz and radius per caster
 * @param count     how many entries of `occluders` are used
 *
 * Several casters multiply their visible fractions (they almost never overlap).
 * The shader in src/features/solarSystem/lighting/sunlightShader.ts is a
 * line-by-line port of this function; keep the two in step.
 */
export function sunVisibleFraction(
	px: number,
	py: number,
	pz: number,
	sx: number,
	sy: number,
	sz: number,
	sunRadiusKm: number,
	occluders: ArrayLike<number>,
	count: number,
): number {
	const tx = sx - px
	const ty = sy - py
	const tz = sz - pz
	const sunDistance = Math.hypot(tx, ty, tz)
	const a = Math.asin(Math.min(sunRadiusKm / sunDistance, 1))
	let visible = 1
	for (let k = 0; k < count; k++) {
		const o = k * OCCLUDER_STRIDE
		const ox = occluders[o] - px
		const oy = occluders[o + 1] - py
		const oz = occluders[o + 2] - pz
		const radius = occluders[o + 3]
		// only a caster between the point and the Sun shades it
		if (ox * tx + oy * ty + oz * tz <= 0) continue
		const distance = Math.hypot(ox, oy, oz)
		if (distance >= sunDistance) continue
		const b = Math.asin(Math.min(radius / distance, 1))
		const c = angleBetween(tx, ty, tz, ox, oy, oz)
		visible *= 1 - Math.min(discOverlapArea(a, b, c) / (Math.PI * a * a), 1)
	}
	return visible
}

/**
 * The bodies that can ever shade body `i`: its parent (a planet's shadow on
 * its moon: a lunar eclipse), its siblings when it is a moon (Jupiter's moons
 * shade each other) and its children (a moon's shadow on its planet: a solar
 * eclipse seen from space). Planets never shade each other in any way worth
 * drawing, and the Sun casts no shadow. Computed once per body.
 */
export function occluderCandidates(
	bodies: readonly LitBody[],
	i: number,
): number[] {
	const body = bodies[i]
	if (body.parentId === null) return []
	const parentIndex = bodies.findIndex((other) => other.id === body.parentId)
	const parentIsRoot = parentIndex < 0 || bodies[parentIndex].parentId === null
	const out: number[] = []
	if (parentIndex >= 0 && !parentIsRoot) out.push(parentIndex)
	bodies.forEach((other, j) => {
		if (j === i) return
		if (other.parentId === body.id) out.push(j)
		else if (!parentIsRoot && other.parentId === body.parentId) out.push(j)
	})
	return out
}

/**
 * Picks at most `MAX_OCCLUDERS` of `candidates` whose penumbra can reach body
 * `receiver` right now, best overlap first, and packs them relative to the
 * receiver's centre into `out` (true km). Returns how many were written.
 *
 * A caster qualifies when it lies sunward of the receiver's far limb and the
 * line from the receiver's centre toward the Sun passes within the receiver's
 * radius plus the width of the caster's penumbra at that distance. `accept`
 * filters casters that are not drawn (hidden moons cast no shadow: a shadow
 * without its caster reads as a bug).
 */
export function selectOccluders(
	bodies: readonly LitBody[],
	positionsKm: ArrayLike<number>,
	receiver: number,
	sun: number,
	candidates: readonly number[],
	accept: (index: number) => boolean,
	out: WritableVec3,
): number {
	const r = receiver * 3
	const s = sun * 3
	const sx = positionsKm[s] - positionsKm[r]
	const sy = positionsKm[s + 1] - positionsKm[r + 1]
	const sz = positionsKm[s + 2] - positionsKm[r + 2]
	const sunDistance = Math.hypot(sx, sy, sz)
	if (sunDistance === 0) return 0
	const ux = sx / sunDistance
	const uy = sy / sunDistance
	const uz = sz / sunDistance
	const sunRadius = bodies[sun].radiusKm
	const receiverRadius = bodies[receiver].radiusKm

	let count = 0
	for (const j of candidates) {
		const o = j * 3
		const vx = positionsKm[o] - positionsKm[r]
		const vy = positionsKm[o + 1] - positionsKm[r + 1]
		const vz = positionsKm[o + 2] - positionsKm[r + 2]
		const along = vx * ux + vy * uy + vz * uz
		const radius = bodies[j].radiusKm
		if (along <= -receiverRadius - radius) continue
		const casterToSun = sunDistance - along
		if (casterToSun <= 0) continue
		const px = vx - along * ux
		const py = vy - along * uy
		const pz = vz - along * uz
		const offAxis = Math.hypot(px, py, pz)
		// penumbra half-width at the receiver: the caster's radius widened by the Sun's
		// apparent radius beyond the caster (plus the receiver's own depth)
		const penumbra =
			radius +
			(Math.max(along, 0) + receiverRadius) *
				((sunRadius + radius) / casterToSun)
		const reach = receiverRadius + penumbra
		if (offAxis >= reach) continue
		if (!accept(j)) continue
		const score = offAxis / reach
		// insertion by score into the fixed-size list
		let slot = count
		while (slot > 0 && score < scores[slot - 1]) slot--
		if (slot >= MAX_OCCLUDERS) continue
		const last = Math.min(count, MAX_OCCLUDERS - 1)
		for (let k = last; k > slot; k--) copyEntry(out, k - 1, k)
		const w = slot * OCCLUDER_STRIDE
		out[w] = vx
		out[w + 1] = vy
		out[w + 2] = vz
		out[w + 3] = radius
		scores[slot] = score
		if (count < MAX_OCCLUDERS) count++
	}
	return count
}

// scores of the entries currently in `out`, by slot (selectOccluders is not re-entrant)
const scores = new Float64Array(MAX_OCCLUDERS)
const copyEntry = (out: WritableVec3, from: number, to: number): void => {
	const f = from * OCCLUDER_STRIDE
	const t = to * OCCLUDER_STRIDE
	for (let k = 0; k < OCCLUDER_STRIDE; k++) out[t + k] = out[f + k]
	scores[to] = scores[from]
}

/**
 * Phase angle in radians at body `target` between the Sun and an observer
 * body (0 = fully lit face toward the observer, pi = the dark side), from
 * true positions.
 */
export function phaseAngle(
	positionsKm: ArrayLike<number>,
	target: number,
	observer: number,
	sun: number,
): number {
	const t = target * 3
	const o = observer * 3
	const s = sun * 3
	return angleBetween(
		positionsKm[s] - positionsKm[t],
		positionsKm[s + 1] - positionsKm[t + 1],
		positionsKm[s + 2] - positionsKm[t + 2],
		positionsKm[o] - positionsKm[t],
		positionsKm[o + 1] - positionsKm[t + 1],
		positionsKm[o + 2] - positionsKm[t + 2],
	)
}

/** Illuminated fraction of the disc an observer sees at `phaseAngle` (1 = full, 0 = new). */
export const illuminatedFraction = (phaseAngleRad: number): number =>
	(1 + Math.cos(phaseAngleRad)) / 2
