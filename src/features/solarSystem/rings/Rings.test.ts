import { describe, expect, it } from "vitest"
import { DoubleSide, Texture, Vector3 } from "three"

import { bodies, getBody } from "@/data"
import {
	SCALE_PRESETS,
	SCALE_PRESET_IDS,
	displayBodyLengthKm,
	spinAxis,
	toUnits,
} from "@/sim"

import { bodyOrientation } from "../bodies/orientation"
import { createSunlightUniforms } from "../lighting/bodyLighting"
import { createRingMaterial } from "../lighting/ringMaterial"
import { createSunlitMaterial } from "../lighting/SunlitMaterial"
import { createSimFrame, setSimFrameScale } from "../scene/simFrame"
import {
	RING_SEGMENTS,
	createRingGeometry,
	ringRadiiInBodyRadii,
} from "./Rings"

const ringed = bodies.filter((body) => body.rings !== null)
const deg = Math.PI / 180

describe("which bodies have rings", () => {
	it("is data only: Jupiter, Saturn, Uranus and Neptune", () => {
		expect(ringed.map((body) => body.id)).toEqual([
			"jupiter",
			"saturn",
			"uranus",
			"neptune",
		])
	})
})

describe("createRingGeometry", () => {
	it("is a flat annulus in the pole frame's equator (XZ), in planet radii, with round edges", () => {
		const saturn = getBody("saturn")
		const rings = saturn.rings!
		const geometry = createRingGeometry(rings, saturn.radiusKm)
		const [inner, outer] = ringRadiiInBodyRadii(rings, saturn.radiusKm)
		expect(inner).toBeCloseTo(74510 / 58232, 9)
		const position = geometry.getAttribute("position")
		let min = Infinity
		let max = 0
		for (let k = 0; k < position.count; k++) {
			expect(Math.abs(position.getY(k))).toBeLessThan(1e-9)
			const r = Math.hypot(position.getX(k), position.getZ(k))
			min = Math.min(min, r)
			max = Math.max(max, r)
		}
		expect(min).toBeCloseTo(inner, 9)
		// the outer polygon's edges touch the outer circle from outside: no flat facets inside it
		expect(max * Math.cos(Math.PI / RING_SEGMENTS)).toBeCloseTo(outer, 9)
	})
})

describe("rings in every scale preset", () => {
	it("keep their true proportion to the planet (displayBodyLengthKm) through runtime switches", () => {
		const frame = createSimFrame(bodies)
		for (const id of [...SCALE_PRESET_IDS, "trueScale", "everythingVisible"]) {
			setSimFrameScale(frame, SCALE_PRESETS[id as keyof typeof SCALE_PRESETS])
			for (const planet of ringed) {
				const i = frame.index.get(planet.id)!
				const rings = planet.rings!
				const [inner, outer] = ringRadiiInBodyRadii(rings, planet.radiusKm)
				// the mesh is scaled by the planet's drawn radius, like its sphere
				const scale = frame.renderRadius(i)
				const drawnOuter = toUnits(
					displayBodyLengthKm(
						rings.outerRadiusKm,
						planet.radiusKm,
						frame.displayRadiiKm[i],
					),
				)
				expect(scale * outer).toBeCloseTo(drawnOuter, 6)
				expect((scale * outer) / (scale * inner)).toBeCloseTo(
					rings.outerRadiusKm / rings.innerRadiusKm,
					12,
				)
				// never inside the planet
				expect(inner).toBeGreaterThan(1)
			}
		}
	})
})

describe("ring orientation", () => {
	const ringNormal = (id: string): Vector3 =>
		new Vector3(0, 1, 0).applyQuaternion(bodyOrientation(getBody(id)))

	it("lies in the planet's equator: the ring normal is the spin axis", () => {
		for (const planet of ringed) {
			const axis = spinAxis(planet.rotation, planet.orbit)
			const normal = ringNormal(planet.id)
			expect(normal.x).toBeCloseTo(axis.x, 9)
			expect(normal.y).toBeCloseTo(axis.y, 9)
			expect(normal.z).toBeCloseTo(axis.z, 9)
		}
	})

	it("tilts Saturn's rings 26.7 deg and stands Uranus's almost on edge to the ecliptic", () => {
		// scene +Y is the ecliptic's north pole
		const tilt = (id: string) => Math.acos(Math.abs(ringNormal(id).y)) / deg
		expect(tilt("saturn")).toBeGreaterThan(26)
		expect(tilt("saturn")).toBeLessThan(29)
		// 97.8 deg to its orbit: the ring plane is 82 deg from the ecliptic, nearly vertical
		expect(tilt("uranus")).toBeGreaterThan(80)
		expect(tilt("jupiter")).toBeLessThan(4)
		expect(tilt("neptune")).toBeGreaterThan(26)
	})
})

describe("ring materials", () => {
	it("share the planet's sunlight uniforms by reference and are see-through from both sides", () => {
		const uniforms = createSunlightUniforms({ radiusKm: 58232 }, 695_700)
		const color = new Texture()
		const peak = new Texture()
		const material = createRingMaterial({
			uniforms,
			color,
			peak,
			innerRadiusKm: 74510,
			outerRadiusKm: 140220,
		})
		expect(material.uniforms.uSunKm).toBe(uniforms.uSunKm)
		expect(material.uniforms.uOccluderCount).toBe(uniforms.uOccluderCount)
		expect(material.uniforms.uAlwaysLit).toBe(uniforms.uAlwaysLit)
		expect(material.uniforms.uRingColor.value).toBe(color)
		expect(material.uniforms.uRingPeak.value).toBe(peak)
		expect(material.uniforms.uRingRadiiKm.value.toArray()).toEqual([
			74510, 140220,
		])
		expect(material.transparent).toBe(true)
		expect(material.depthWrite).toBe(false)
		expect(material.side).toBe(DoubleSide)
		expect(material.fragmentShader).toContain("sunlightCasterVisibility")
	})

	it("switch the planet's ring shadow on by define, so ringless bodies pay nothing", () => {
		const uniforms = createSunlightUniforms({ radiusKm: 58232 }, 695_700)
		const color = new Texture()
		const planet = createSunlitMaterial({
			uniforms,
			ringShadow: { color, innerRadiusKm: 74510, outerRadiusKm: 140220 },
		})
		expect(planet.defines).toEqual({ USE_RING_SHADOW: "" })
		expect(planet.uniforms.uRingColor.value).toBe(color)
		expect(planet.uniforms.uSunKm).toBe(uniforms.uSunKm)
		expect(planet.fragmentShader).toContain("ringTransmittance")
		expect(createSunlitMaterial({ uniforms }).defines).toEqual({})
	})
})
