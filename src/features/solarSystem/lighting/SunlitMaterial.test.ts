import { describe, expect, it } from "vitest"
import { Texture } from "three"

import { createSunlightUniforms } from "./bodyLighting"
import { createSunlitMaterial } from "./SunlitMaterial"

describe("createSunlitMaterial", () => {
	it("shares the body's uniform objects, so scalars written every frame reach the GPU", () => {
		const uniforms = createSunlightUniforms({ radiusKm: 6371 }, 695_700)
		const material = createSunlitMaterial({ uniforms })
		expect(material.uniforms.uAlwaysLit).toBe(uniforms.uAlwaysLit)
		expect(material.uniforms.uOccluderCount).toBe(uniforms.uOccluderCount)
		expect(material.uniforms.uSunKm).toBe(uniforms.uSunKm)
		uniforms.uAlwaysLit.value = 1
		expect(material.uniforms.uAlwaysLit.value).toBe(1)
		expect(material.defines).toEqual({})
	})

	it("switches the map and the night lights on by define", () => {
		const uniforms = createSunlightUniforms({ radiusKm: 6371 }, 695_700)
		const map = new Texture()
		const nightMap = new Texture()
		const material = createSunlitMaterial({ uniforms, map, nightMap })
		expect(material.defines).toEqual({ USE_BODY_MAP: "", USE_NIGHT_MAP: "" })
		expect(material.uniforms.uMap.value).toBe(map)
		expect(material.uniforms.uNightMap.value).toBe(nightMap)
	})
})
