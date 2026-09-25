/**
 * GLSL shared by planetary rings and their planet's sphere (issue #12;
 * docs/ARCHITECTURE.md, "Rings"): the ring strip textures
 * (../rings/ringTextures.ts), `ringSlantOpacity` and `ringTransmittance`,
 * line-by-line ports of `slantOpacity` and `ringShadowTransmittance` in
 * src/sim/rings.ts (keep them in step). Include it after `SUNLIGHT_PARS`
 * (it reads `uSunKm`). The planet's shader includes it behind
 * `USE_RING_SHADOW`, so ringless bodies pay nothing.
 */
import { Vector2, type Texture } from "three"

import { RING_MIN_MU } from "@/sim"

export const RING_PARS = /* glsl */ `
#define RING_MIN_MU ${RING_MIN_MU.toFixed(4)}

// RGB: colour (sRGB texture), A: mean face-on opacity; u across the rings, v = 0.5
uniform sampler2D uRingColor;
// the rings' inner and outer radius (true km)
uniform vec2 uRingRadiiKm;

float ringU(float radiusKm) {
	return (radiusKm - uRingRadiiKm.x) / (uRingRadiiKm.y - uRingRadiiKm.x);
}

// opacity of the sheet crossed at cosine mu to its normal (Beer-Lambert)
float ringSlantOpacity(float opacity, float mu) {
	return 1.0 - pow(1.0 - clamp(opacity, 0.0, 1.0), 1.0 / max(abs(mu), RING_MIN_MU));
}

// fraction of sunlight reaching p (planet frame, true km) through the rings; pole: unit, scene axes
float ringTransmittance(vec3 p, vec3 pole) {
	vec3 l = normalize(uSunKm - p);
	float dn = dot(l, pole);
	float t = -dot(p, pole) / (abs(dn) < 1e-9 ? 1e-9 : dn);
	float u = ringU(length(p + l * t));
	// sampled on every path: texture derivatives need uniform control flow
	float opacity = texture2D(uRingColor, vec2(clamp(u, 0.0, 1.0), 0.5)).a;
	if (abs(dn) < 1e-9 || t <= 0.0 || u < 0.0 || u > 1.0) return 1.0;
	return 1.0 - ringSlantOpacity(opacity, dn);
}
`

/** What `RING_PARS` reads: the rings' colour/opacity strip and their radii. */
export interface RingShadow {
	/** RGB colour (sRGB), A mean face-on opacity (../rings/ringTextures.ts) */
	color: Texture
	innerRadiusKm: number
	outerRadiusKm: number
}

/** The uniforms `RING_PARS` declares, for a material that includes it. */
export const ringParsUniforms = ({
	color,
	innerRadiusKm,
	outerRadiusKm,
}: RingShadow) => ({
	uRingColor: { value: color },
	uRingRadiiKm: { value: new Vector2(innerRadiusKm, outerRadiusKm) },
})
