/**
 * The material of every body except the Sun (docs/ARCHITECTURE.md,
 * "Lighting"): a ShaderMaterial over the body's shared sunlight uniforms
 * (./bodyLighting.ts), optionally with its colour map and a night map
 * (city lights). Uniform objects are shared, not copied, so the per-frame
 * `updateSunlight` reaches every material the body has, including the
 * fallback shown while its textures load.
 */
import { useMemo } from "react"
import type { Texture } from "three"
import { Color } from "three"

import type { SunlightUniforms } from "./bodyLighting"
import { NIGHT_LIGHTS_INTENSITY } from "./bodyLighting"
import { bodyFragmentShader, bodyVertexShader } from "./sunlightShader"

export interface SunlitMaterialProps {
	uniforms: SunlightUniforms
	/** Multiplies the map; the whole colour when there is no map (linear sRGB hex or CSS colour). */
	color?: string
	map?: Texture
	nightMap?: Texture
}

function SunlitMaterial({
	uniforms,
	color = "#ffffff",
	map,
	nightMap,
}: SunlitMaterialProps) {
	const materialUniforms = useMemo(
		() => ({
			...uniforms,
			uColor: { value: new Color(color) },
			uMap: { value: map ?? null },
			uNightMap: { value: nightMap ?? null },
			uNightLightsIntensity: { value: NIGHT_LIGHTS_INTENSITY },
		}),
		[uniforms, color, map, nightMap],
	)
	const defines = useMemo(() => {
		const out: Record<string, string> = {}
		if (map !== undefined) out.USE_BODY_MAP = ""
		if (nightMap !== undefined) out.USE_NIGHT_MAP = ""
		return out
	}, [map, nightMap])

	return (
		<shaderMaterial
			// a new material whenever the uniforms object changes: three binds it at compile time
			key={`${map?.uuid ?? "-"}:${nightMap?.uuid ?? "-"}:${color}`}
			uniforms={materialUniforms}
			defines={defines}
			vertexShader={bodyVertexShader}
			fragmentShader={bodyFragmentShader}
		/>
	)
}

export default SunlitMaterial
