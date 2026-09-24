/**
 * The material of a planet's rings (issue #12; docs/ARCHITECTURE.md, "Rings"):
 * a transparent, double-sided ShaderMaterial over the PLANET's sunlight
 * uniforms, shared by reference (see ./SunlitMaterial.tsx for why they are
 * never copied), plus the ring strips.
 */
import { DoubleSide, ShaderMaterial, type Texture } from "three"

import type { SunlightUniforms } from "./bodyLighting"
import { ringParsUniforms, type RingShadow } from "./ringPars"
import { ringFragmentShader, ringVertexShader } from "./ringShader"

export interface RingMaterialOptions extends RingShadow {
	/** the planet's sunlight uniforms */
	uniforms: SunlightUniforms
	/** R: the highest face-on opacity over a texel's footprint */
	peak: Texture
}

export function createRingMaterial({
	uniforms,
	peak,
	...rings
}: RingMaterialOptions): ShaderMaterial {
	return new ShaderMaterial({
		uniforms: {
			...uniforms,
			...ringParsUniforms(rings),
			uRingPeak: { value: peak },
		},
		vertexShader: ringVertexShader,
		fragmentShader: ringFragmentShader,
		transparent: true,
		// seen through: the planet and its far half of the rings must stay visible behind
		depthWrite: false,
		side: DoubleSide,
	})
}
