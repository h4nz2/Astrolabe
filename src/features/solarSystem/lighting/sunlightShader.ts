/**
 * GLSL of the sunlight model (docs/ARCHITECTURE.md, "Lighting"; issue #22).
 *
 * `SUNLIGHT_PARS` is the reusable part: the uniforms every sunlit surface
 * shares and `sunVisibility()`, a port of `sunVisibleFraction` in
 * src/sim/lighting.ts (keep the two in step; the unit tests pin the
 * TypeScript one). Anything else that must be lit by the Sun (rings, #12)
 * includes it and feeds it a point in the receiving body's TRUE frame:
 * receiver centre at the origin, true km, scene axes.
 *
 * `bodyVertexShader` / `bodyFragmentShader` shade a body's sphere: a
 * Lambert terminator facing the true Sun, eclipse shadows, a faint starlight
 * floor and a cool rim so the night side never disappears, city lights from
 * a night texture, and the "always lit" teaching mode.
 */
import { MAX_OCCLUDERS } from "@/sim"

export const SUNLIGHT_PARS = /* glsl */ `
#define SUNLIGHT_MAX_OCCLUDERS ${MAX_OCCLUDERS}

// the Sun's centre relative to the receiver's centre (true km, scene axes)
uniform vec3 uSunKm;
uniform float uSunRadiusKm;
// casters relative to the receiver's centre: xyz (true km), w = radius (km)
uniform vec4 uOccluders[SUNLIGHT_MAX_OCCLUDERS];
uniform int uOccluderCount;

float sunlightDiscOverlap(float a, float b, float c) {
	if (c >= a + b) return 0.0;
	float small = min(a, b);
	if (c <= abs(a - b)) return PI * small * small;
	float a2 = a * a;
	float b2 = b * b;
	float c2 = c * c;
	float alpha = acos(clamp((c2 + a2 - b2) / (2.0 * c * a), -1.0, 1.0));
	float beta = acos(clamp((c2 + b2 - a2) / (2.0 * c * b), -1.0, 1.0));
	float kite = (-c + a + b) * (c + a - b) * (c - a + b) * (c + a + b);
	return a2 * alpha + b2 * beta - 0.5 * sqrt(max(kite, 0.0));
}

// angle between two directions from the chord of their unit vectors (exact for tiny angles)
float sunlightAngle(vec3 a, vec3 b) {
	return 2.0 * asin(min(length(normalize(a) - normalize(b)) * 0.5, 1.0));
}

// fraction of the Sun's disc visible from point p (receiver frame, true km)
float sunVisibility(vec3 p) {
	vec3 toSun = uSunKm - p;
	float sunDistance = length(toSun);
	float a = asin(min(uSunRadiusKm / sunDistance, 1.0));
	float visible = 1.0;
	for (int k = 0; k < SUNLIGHT_MAX_OCCLUDERS; k++) {
		if (k >= uOccluderCount) break;
		vec3 toCaster = uOccluders[k].xyz - p;
		if (dot(toCaster, toSun) <= 0.0) continue;
		float casterDistance = length(toCaster);
		if (casterDistance >= sunDistance) continue;
		float b = asin(min(uOccluders[k].w / casterDistance, 1.0));
		float c = sunlightAngle(toSun, toCaster);
		visible *= 1.0 - min(sunlightDiscOverlap(a, b, c) / (PI * a * a), 1.0);
	}
	return visible;
}
`

export const bodyVertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vWorldPosition;

void main() {
	vUv = uv;
	// the mesh scales uniformly, so the model matrix keeps normals perpendicular
	vNormalWorld = normalize(mat3(modelMatrix) * normal);
	vec4 world = modelMatrix * vec4(position, 1.0);
	vWorldPosition = world.xyz;
	gl_Position = projectionMatrix * viewMatrix * world;
	#include <logdepthbuf_vertex>
}
`

export const bodyFragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
${SUNLIGHT_PARS}

uniform vec3 uColor;
uniform float uBodyRadiusKm;
uniform float uAlwaysLit;
uniform float uSunIntensity;
uniform float uNightLevel;
uniform vec3 uRimColor;
#ifdef USE_BODY_MAP
uniform sampler2D uMap;
#endif
#ifdef USE_NIGHT_MAP
uniform sampler2D uNightMap;
uniform float uNightLightsIntensity;
#endif

varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vWorldPosition;

void main() {
	#include <logdepthbuf_fragment>
	vec3 albedo = uColor;
	#ifdef USE_BODY_MAP
	albedo *= texture2D(uMap, vUv).rgb;
	#endif

	vec3 n = normalize(vNormalWorld);
	vec3 v = normalize(cameraPosition - vWorldPosition);
	float facing = max(dot(n, v), 0.0);

	vec3 color;
	if (uAlwaysLit > 0.5) {
		// teaching mode: lit from the viewer, the whole face visible and still round
		color = albedo * uSunIntensity * (0.35 + 0.65 * facing);
	} else {
		vec3 l = normalize(uSunKm);
		float ndl = dot(n, l);
		// the same direction on the true-size globe: the shadow lands where it really does
		float shade = ndl > -0.05 ? sunVisibility(n * uBodyRadiusKm) : 1.0;
		float day = max(ndl, 0.0) * shade;
		// how far into the night this point is (0 by day, 1 past a short twilight band)
		float night = 1.0 - smoothstep(-0.08, 0.12, ndl * shade);
		color = albedo * (uSunIntensity * day + uNightLevel);
		#ifdef USE_NIGHT_MAP
		color += texture2D(uNightMap, vUv).rgb * uNightLightsIntensity * night;
		#endif
		// starlight rim: keeps the silhouette of the night side readable against space
		float rim = pow(1.0 - facing, 3.0);
		color += uRimColor * rim * night;
	}
	gl_FragColor = vec4(color, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`
