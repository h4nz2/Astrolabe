/**
 * The material of every body except the Sun (docs/ARCHITECTURE.md,
 * "Lighting"): a ShaderMaterial over the body's shared sunlight uniforms
 * (./bodyLighting.ts), optionally with its colour map and a night map
 * (city lights). The uniform objects are shared, not copied, so the per-frame
 * `updateSunlight` reaches every material the body has, including the
 * fallback shown while its textures load.
 *
 * The material is built here and handed to R3F as a primitive: R3F's
 * `<shaderMaterial uniforms>` prop copies every uniform into a new object, so
 * scalar uniforms written later (the caster count, "always lit") would never
 * reach the GPU.
 */
import { useEffect, useMemo } from "react"
import { Color, ShaderMaterial, type Texture } from "three"

import { NIGHT_LIGHTS_INTENSITY, type SunlightUniforms } from "./bodyLighting"
import { bodyFragmentShader, bodyVertexShader } from "./sunlightShader"

export interface SunlitMaterialProps {
	uniforms: SunlightUniforms
	/** Multiplies the map; the whole colour when there is no map (a CSS colour, sRGB). */
	color?: string
	map?: Texture
	nightMap?: Texture
}

/** A body material over `uniforms` (shared by reference) plus its own textures. */
export function createSunlitMaterial({
	uniforms,
	color = "#ffffff",
	map,
	nightMap,
}: SunlitMaterialProps): ShaderMaterial {
	const defines: Record<string, string> = {}
	if (map !== undefined) defines.USE_BODY_MAP = ""
	if (nightMap !== undefined) defines.USE_NIGHT_MAP = ""
	return new ShaderMaterial({
		uniforms: {
			...uniforms,
			uColor: { value: new Color(color) },
			uMap: { value: map ?? null },
			uNightMap: { value: nightMap ?? null },
			uNightLightsIntensity: { value: NIGHT_LIGHTS_INTENSITY },
		},
		defines,
		vertexShader: bodyVertexShader,
		fragmentShader: bodyFragmentShader,
	})
}

function SunlitMaterial({
	uniforms,
	color,
	map,
	nightMap,
}: SunlitMaterialProps) {
	const material = useMemo(
		() => createSunlitMaterial({ uniforms, color, map, nightMap }),
		[uniforms, color, map, nightMap],
	)
	useEffect(() => () => material.dispose(), [material])
	return <primitive object={material} attach="material" />
}

export default SunlitMaterial
