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
/**
 * The edge-on line: exactly edge-on a flat sheet covers no pixel, so an outer
 * rim this many pixels tall stands in for it, fading out once the sheet itself
 * opens up (|cos| of the view to the ring plane's normal above RING_EDGE_FADE).
 */
export const RING_EDGE_PX = 1.5
export const RING_EDGE_FADE = 0.03
/**
 * Pushes the rings a hair back in the (logarithmic) depth buffer, so the orbit
 * lines of the ring moons, which lie in the same plane, draw over the rings
 * instead of dashing through them. 1e-5 of log depth is 0.02 % of the distance.
 */
export const RING_DEPTH_BIAS = 1e-5

const defines = /* glsl */ `
#define RING_THIN_VISIBILITY ${RING_THIN_VISIBILITY.toFixed(4)}
#define RING_MIN_LUMINANCE ${RING_MIN_LUMINANCE.toFixed(4)}
#define RING_BRIGHTNESS ${RING_BRIGHTNESS.toFixed(4)}
#define RING_GRAZING_LIGHT ${RING_GRAZING_LIGHT.toFixed(4)}
#define RING_BACKLIT_DENSE ${RING_BACKLIT_DENSE.toFixed(4)}
#define RING_EDGE_PX ${RING_EDGE_PX.toFixed(4)}
#define RING_EDGE_FADE ${RING_EDGE_FADE.toFixed(4)}
#define RING_DEPTH_BIAS ${RING_DEPTH_BIAS.toExponential()}
`

/**
 * One vertex shader for the sheet (an annulus in the pole frame's XZ plane) and,
 * with RING_EDGE, the edge-on rim (an open cylinder at the outer radius, y in
 * -1..1, flattened into the plane and extruded RING_EDGE_PX pixels along the pole).
 * Both are in planet radii, scaled by the planet's drawn radius.
 */
export const ringVertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
${defines}

uniform float uBodyRadiusKm;
#ifdef RING_EDGE
uniform float uViewportHeight;
#endif

varying vec2 vLocal;
varying vec3 vTrueKm;
varying vec3 vPole;
varying vec3 vWorldPosition;

void main() {
	vec3 local = vec3(position.x, 0.0, position.z);
	vLocal = local.xz;
	mat3 m = mat3(modelMatrix);
	// the mesh scales uniformly by the drawn radius: undo it for the true frame
	float drawnRadius = length(m[0]);
	vTrueKm = m * local * (uBodyRadiusKm / drawnRadius);
	vPole = normalize(m * vec3(0.0, 1.0, 0.0));
	vec4 world = modelMatrix * vec4(local, 1.0);
	#ifdef RING_EDGE
	// the size of a pixel at this depth, in world units
	float pixel = -(viewMatrix * world).z * 2.0 / (projectionMatrix[1][1] * uViewportHeight);
	world.xyz += vPole * position.y * 0.5 * RING_EDGE_PX * pixel;
	#endif
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
${defines}

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

// sunlight on a patch of ring of colour albedo and mean face-on opacity
vec3 ringShade(vec3 albedo, float meanOpacity, vec3 pole, float viewUp) {
	float luminance = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
	albedo *= max(1.0, RING_MIN_LUMINANCE / max(luminance, 1e-4));
	if (uAlwaysLit > 0.5) return albedo * uSunIntensity * RING_BRIGHTNESS;
	vec3 l = normalize(uSunKm - vTrueKm);
	float sunUp = dot(pole, l);
	// the planet's shadow (the planet as a caster at the centre) and its moons' shadows
	float shade = sunVisibility(vTrueKm)
		* sunlightCasterVisibility(vTrueKm, vec4(0.0, 0.0, 0.0, uBodyRadiusKm));
	// the Sun low over the rings lights them dimly (equinox)
	float grazing = mix(RING_GRAZING_LIGHT, 1.0, smoothstep(0.0, 0.25, abs(sunUp)));
	// the unlit face: light gets through thin rings, dense rings stay dark
	float face = sunUp * viewUp >= 0.0 ? 1.0 : mix(1.0, RING_BACKLIT_DENSE, meanOpacity);
	return albedo * (uSunIntensity * RING_BRIGHTNESS * grazing * face * shade + uNightLevel);
}

void main() {
	#include <logdepthbuf_fragment>
	#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = min(gl_FragDepth + RING_DEPTH_BIAS, 1.0);
	#endif
	vec3 pole = normalize(vPole);
	vec3 v = normalize(cameraPosition - vWorldPosition);
	float viewUp = dot(pole, v);

	#ifdef RING_EDGE
	// the whole ring system seen along its plane: the strip's last (1-texel) level
	vec4 ring = textureLod(uRingColor, vec2(0.5, 0.5), 16.0);
	float alpha = ringSlantOpacity(ring.a, 0.0) * (1.0 - smoothstep(0.0, RING_EDGE_FADE, abs(viewUp)));
	#else
	float u = ringU(length(vLocal) * uBodyRadiusKm);
	vec2 uv = vec2(clamp(u, 0.0, 1.0), 0.5);
	// both samples before any discard: mip selection needs the derivatives
	vec4 ring = texture2D(uRingColor, uv);
	float peak = texture2D(uRingPeak, uv).r;
	if (u < 0.0 || u > 1.0) discard;
	// a ring thinner than a pixel is kept as a faint line instead of averaging away
	float faceOpacity = max(ring.a, RING_THIN_VISIBILITY * peak);
	// seen at a slant the sheet is denser (Beer-Lambert)
	float alpha = ringSlantOpacity(faceOpacity, viewUp);
	#endif
	if (alpha < 0.004) discard;

	gl_FragColor = vec4(ringShade(ring.rgb, ring.a, pole, viewUp), alpha);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`
