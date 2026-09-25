/**
 * Planetary rings as a thin sheet in the planet's equatorial plane (issue #12;
 * docs/ARCHITECTURE.md, "Rings"). Pure geometry and optics in TRUE km, with
 * the planet's centre at the origin and the pole as a unit vector in scene
 * axes (`spinAxis`).
 *
 * A ring's opacity is given face-on (seen along the pole). Light that crosses
 * the sheet at a slant passes through more particles: with `mu` the cosine of
 * the angle to the pole, the transmittance is `(1 - opacity) ** (1 / mu)`
 * (Beer-Lambert). That is why rings seen almost edge-on look dense and bright,
 * and why their shadow on the planet darkens when the Sun is low over them.
 *
 * The ring shader (src/features/solarSystem/lighting/ringShader.ts) is a
 * line-by-line port of `slantOpacity` and `ringShadowTransmittance`; keep the
 * two in step.
 */
import type { Vec3 } from "./kepler"

/** Below this cosine a slant path is treated as this cosine: nearly edge-on is dense, never infinite. */
export const RING_MIN_MU = 0.02

/** Opacity of a sheet of face-on opacity `opacity`, crossed at cosine `mu` to its normal. */
export function slantOpacity(opacity: number, mu: number): number {
	const clamped = Math.min(Math.max(opacity, 0), 1)
	return 1 - (1 - clamped) ** (1 / Math.max(Math.abs(mu), RING_MIN_MU))
}

/** Position `u` across the rings: 0 at the inner edge, 1 at the outer edge (the texture strip's u). */
export const ringU = (
	radiusKm: number,
	innerRadiusKm: number,
	outerRadiusKm: number,
): number => (radiusKm - innerRadiusKm) / (outerRadiusKm - innerRadiusKm)

/**
 * Fraction of the sunlight that reaches point `p` through the rings: 1 when
 * the ray from `p` toward the Sun (`sun`, also relative to the planet's
 * centre) does not cross the ring plane between the ring radii, else the
 * slant transmittance of the ring where it crosses. `opacityAt(u)` is the
 * face-on opacity across the rings.
 */
export function ringShadowTransmittance(
	p: Vec3,
	sun: Vec3,
	pole: Vec3,
	innerRadiusKm: number,
	outerRadiusKm: number,
	opacityAt: (u: number) => number,
): number {
	const dx = sun.x - p.x
	const dy = sun.y - p.y
	const dz = sun.z - p.z
	const length = Math.hypot(dx, dy, dz)
	const lx = dx / length
	const ly = dy / length
	const lz = dz / length
	const dn = lx * pole.x + ly * pole.y + lz * pole.z
	// a ray parallel to the ring plane never crosses it
	if (Math.abs(dn) < 1e-9) return 1
	const t = -(p.x * pole.x + p.y * pole.y + p.z * pole.z) / dn
	if (t <= 0) return 1
	const u = ringU(
		Math.hypot(p.x + lx * t, p.y + ly * t, p.z + lz * t),
		innerRadiusKm,
		outerRadiusKm,
	)
	if (u < 0 || u > 1) return 1
	return 1 - slantOpacity(opacityAt(u), dn)
}
