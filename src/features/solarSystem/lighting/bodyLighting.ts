/**
 * The per-body side of the sunlight model (docs/ARCHITECTURE.md, "Lighting").
 * `createSunlightUniforms` builds the uniforms a sunlit material reads
 * (declared by `SUNLIGHT_PARS` in ./sunlightShader.ts) and
 * `updateSunlight` rewrites them once per frame from the SimFrame's TRUE
 * positions: the Sun's direction and distance, and the bodies whose shadow
 * can fall on this one right now (src/sim/lighting.ts picks them).
 *
 * Anything drawn that belongs to a body and must be lit by the Sun (its
 * rings, #12) shares that body's uniforms object: the lighting state of a
 * body exists exactly once.
 */
import { Color, Vector3 } from "three"

import type { Body } from "@/data"
import { MAX_OCCLUDERS, OCCLUDER_STRIDE, selectOccluders } from "@/sim"

import type { SimFrame } from "../scene/simFrame"

/** Linear multiplier of the albedo in full sunlight (then ACES tone mapping). */
export const SUN_INTENSITY = 1.6
/**
 * Starlight floor on the night side: a fraction of full sunlight. Not physical
 * (the real night side of an airless moon is black); it keeps what a body IS
 * readable on a projector without hiding which side is night.
 */
export const NIGHT_LEVEL = 0.045
/** Colour of the faint rim that outlines a body's night side against space (linear RGB). */
export const NIGHT_RIM_COLOR = new Color(0.09, 0.11, 0.16)
/** Brightness of a night texture (city lights) on the night side. */
export const NIGHT_LIGHTS_INTENSITY = 1.2

export interface SunlightUniforms {
	[uniform: string]: { value: unknown }
	uSunKm: { value: Vector3 }
	uSunRadiusKm: { value: number }
	uOccluders: { value: Float32Array }
	uOccluderCount: { value: number }
	uBodyRadiusKm: { value: number }
	uAlwaysLit: { value: number }
	uSunIntensity: { value: number }
	uNightLevel: { value: number }
	uRimColor: { value: Color }
}

/** Fresh uniforms for one body; the Sun's direction is filled in by the first `updateSunlight`. */
export function createSunlightUniforms(
	body: Pick<Body, "radiusKm">,
	sunRadiusKm: number,
): SunlightUniforms {
	return {
		uSunKm: { value: new Vector3(1, 0, 0) },
		uSunRadiusKm: { value: sunRadiusKm },
		uOccluders: { value: new Float32Array(MAX_OCCLUDERS * OCCLUDER_STRIDE) },
		uOccluderCount: { value: 0 },
		uBodyRadiusKm: { value: body.radiusKm },
		uAlwaysLit: { value: 0 },
		uSunIntensity: { value: SUN_INTENSITY },
		uNightLevel: { value: NIGHT_LEVEL },
		uRimColor: { value: NIGHT_RIM_COLOR },
	}
}

// packed caster list in doubles; relative values are then narrowed to the float32 uniform
const occluderScratch = new Float64Array(MAX_OCCLUDERS * OCCLUDER_STRIDE)

/**
 * One frame of lighting for body `index`: the Sun relative to it and its
 * current shadow casters, all from true positions (never the display ones:
 * a moon drawn ten times too big must not cast a ten times bigger shadow).
 * `accept` drops casters that are not drawn.
 */
export function updateSunlight(
	uniforms: SunlightUniforms,
	frame: SimFrame,
	index: number,
	sunIndex: number,
	candidates: readonly number[],
	accept: (index: number) => boolean,
	alwaysLit: boolean,
): void {
	const p = frame.positionsKm
	const r = index * 3
	const s = sunIndex * 3
	uniforms.uSunKm.value.set(
		p[s] - p[r],
		p[s + 1] - p[r + 1],
		p[s + 2] - p[r + 2],
	)
	uniforms.uAlwaysLit.value = alwaysLit ? 1 : 0
	const count =
		alwaysLit || candidates.length === 0
			? 0
			: selectOccluders(
					frame.bodies,
					p,
					index,
					sunIndex,
					candidates,
					accept,
					occluderScratch,
				)
	uniforms.uOccluders.value.set(occluderScratch)
	uniforms.uOccluderCount.value = count
}
