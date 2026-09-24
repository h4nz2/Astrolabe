/**
 * GLSL of planetary rings (issue #12; docs/ARCHITECTURE.md, "Rings" and
 * "Lighting").
 *
 * `ringVertexShader` / `ringFragmentShader` draw the ring sheet: a flat annulus
 * in the pole frame's XZ plane (the equator), in planet radii, scaled like the
 * planet. It is lit through the planet's own sunlight uniforms: the planet's
 * shadow on the rings is the planet as a caster at the centre, and its moons'
 * shadows come with the planet's casters.
 */
import { RING_PARS } from "./ringPars"
import { SUNLIGHT_PARS } from "./sunlightShader"

/** How strongly the peak opacity keeps a ring narrower than a pixel drawn (0: only the mean). */
export const RING_THIN_VISIBILITY = 0.6
/**
 * Lowest albedo (linear luminance) a ring is drawn with. Uranus's and Neptune's
 * rings are as dark as soot; drawn true they vanish on a projector. Brighter
 * rings (Saturn's) keep their colour. Not physical, deliberately legible.
 */
export const RING_MIN_LUMINANCE = 0.22
/** Brightness of the sunlit face relative to a body's surface in full sunlight. */
export const RING_BRIGHTNESS = 0.9
/** Brightness left when the Sun grazes the ring plane (near a planet's equinox the rings go dim). */
export const RING_GRAZING_LIGHT = 0.5
/** The unlit face of a fully opaque ring, relative to its lit face (thin rings let the light through). */
export const RING_BACKLIT_DENSE = 0.3

export const ringVertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

uniform float uBodyRadiusKm;

varying vec2 vLocal;
varying vec3 vTrueKm;
varying vec3 vPole;
varying vec3 vWorldPosition;

void main() {
	// the annulus lies in the pole frame's XZ plane, in planet radii
	vLocal = position.xz;
	mat3 m = mat3(modelMatrix);
	// the mesh scales uniformly by the drawn radius: undo it for the true frame
	float drawnRadius = length(m[0]);
	vTrueKm = m * position * (uBodyRadiusKm / drawnRadius);
	vPole = normalize(m * vec3(0.0, 1.0, 0.0));
	vec4 world = modelMatrix * vec4(position, 1.0);
	vWorldPosition = world.xyz;
	gl_Position = projectionMatrix * viewMatrix * world;
	#include <logdepthbuf_vertex>
}
`

export const ringFragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${SUNLIGHT_PARS}
${RING_PARS}

#define RING_THIN_VISIBILITY ${RING_THIN_VISIBILITY.toFixed(4)}
#define RING_MIN_LUMINANCE ${RING_MIN_LUMINANCE.toFixed(4)}
#define RING_BRIGHTNESS ${RING_BRIGHTNESS.toFixed(4)}
#define RING_GRAZING_LIGHT ${RING_GRAZING_LIGHT.toFixed(4)}
#define RING_BACKLIT_DENSE ${RING_BACKLIT_DENSE.toFixed(4)}

// R: the highest face-on opacity over the footprint
uniform sampler2D uRingPeak;
uniform float uBodyRadiusKm;
uniform float uAlwaysLit;
uniform float uSunIntensity;
uniform float uNightLevel;

varying vec2 vLocal;
varying vec3 vTrueKm;
varying vec3 vPole;
varying vec3 vWorldPosition;

void main() {
	#include <logdepthbuf_fragment>
	float u = ringU(length(vLocal) * uBodyRadiusKm);
	vec2 uv = vec2(clamp(u, 0.0, 1.0), 0.5);
	// both samples before any discard: mip selection needs the derivatives
	vec4 ring = texture2D(uRingColor, uv);
	float peak = texture2D(uRingPeak, uv).r;
	if (u < 0.0 || u > 1.0) discard;

	// a ring thinner than a pixel is kept as a faint line instead of averaging away
	float faceOpacity = max(ring.a, RING_THIN_VISIBILITY * peak);
	vec3 pole = normalize(vPole);
	vec3 v = normalize(cameraPosition - vWorldPosition);
	float viewUp = dot(pole, v);
	// seen at a slant the sheet is denser; edge-on it is a dense line, never a hole
	float alpha = ringSlantOpacity(faceOpacity, viewUp);
	if (alpha < 0.004) discard;

	vec3 albedo = ring.rgb;
	float luminance = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
	albedo *= max(1.0, RING_MIN_LUMINANCE / max(luminance, 1e-4));

	vec3 color;
	if (uAlwaysLit > 0.5) {
		color = albedo * uSunIntensity * RING_BRIGHTNESS;
	} else {
		vec3 l = normalize(uSunKm - vTrueKm);
		float sunUp = dot(pole, l);
		// the planet's shadow (the planet as a caster at the centre) and its moons' shadows
		float shade = sunVisibility(vTrueKm)
			* sunlightCasterVisibility(vTrueKm, vec4(0.0, 0.0, 0.0, uBodyRadiusKm));
		// the Sun low over the rings lights them dimly (equinox)
		float grazing = mix(RING_GRAZING_LIGHT, 1.0, smoothstep(0.0, 0.25, abs(sunUp)));
		// the unlit face: light gets through thin rings, dense rings stay dark
		float face = sunUp * viewUp >= 0.0 ? 1.0 : mix(1.0, RING_BACKLIT_DENSE, ring.a);
		color = albedo * (uSunIntensity * RING_BRIGHTNESS * grazing * face * shade + uNightLevel);
	}
	gl_FragColor = vec4(color, alpha);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`
