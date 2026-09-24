/**
 * A planet's rings (issue #12; docs/ARCHITECTURE.md, "Rings"). Rendered as a
 * child of BodyMesh's pole-frame group, so they lie in the equator and follow
 * the axial tilt but never the spin. The annulus is built in planet radii and
 * scaled every frame by the planet's drawn radius, exactly like the sphere:
 * rings keep their true proportion to the planet in every scale preset
 * (`displayBodyLengthKm`) and can never detach from it.
 */
import { use, useEffect, useMemo, useRef } from "react"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import { RingGeometry, type Mesh } from "three"

import type { SunlightUniforms } from "../lighting/bodyLighting"
import { createRingMaterial } from "../lighting/ringMaterial"
import { useSimFrame } from "../scene/simFrame"
import { loadRingTextures, type RingData } from "./ringTextures"

/** Segments around the ring: smooth edges on a ring filling the screen. */
export const RING_SEGMENTS = 256

/** The rings' inner and outer radius in planet radii: the unit the annulus is built in. */
export const ringRadiiInBodyRadii = (
	rings: Pick<RingData, "innerRadiusKm" | "outerRadiusKm">,
	radiusKm: number,
): [number, number] => [
	rings.innerRadiusKm / radiusKm,
	rings.outerRadiusKm / radiusKm,
]

/**
 * A flat annulus in the XZ plane (the pole frame's equator), in planet radii.
 * Its outer polygon circumscribes the outer circle and the shader cuts the
 * exact edges by radius, so both edges stay round up close.
 */
export function createRingGeometry(
	rings: Pick<RingData, "innerRadiusKm" | "outerRadiusKm">,
	radiusKm: number,
	segments = RING_SEGMENTS,
): RingGeometry {
	const [inner, outer] = ringRadiiInBodyRadii(rings, radiusKm)
	const geometry = new RingGeometry(
		inner,
		outer / Math.cos(Math.PI / segments),
		segments,
		1,
	)
	return geometry.rotateX(-Math.PI / 2)
}

export interface RingsProps {
	rings: RingData
	radiusKm: number
	/** the planet's index in the SimFrame */
	index: number
	/** the planet's sunlight uniforms (shared, never copied) */
	uniforms: SunlightUniforms
	onClick?: (event: ThreeEvent<MouseEvent>) => void
	onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
	onPointerOut?: (event: ThreeEvent<PointerEvent>) => void
}

function Rings({ rings, radiusKm, index, uniforms, ...handlers }: RingsProps) {
	const frame = useSimFrame()
	const meshRef = useRef<Mesh>(null)
	const textures = use(loadRingTextures(rings))
	const geometry = useMemo(
		() => createRingGeometry(rings, radiusKm),
		[rings, radiusKm],
	)
	const material = useMemo(
		() =>
			createRingMaterial({
				uniforms,
				color: textures.color,
				peak: textures.peak,
				innerRadiusKm: rings.innerRadiusKm,
				outerRadiusKm: rings.outerRadiusKm,
			}),
		[uniforms, textures, rings],
	)
	useEffect(() => () => geometry.dispose(), [geometry])
	useEffect(() => () => material.dispose(), [material])

	useFrame(() => {
		// the planet's drawn radius, the same scale as its sphere
		meshRef.current?.scale.setScalar(frame.renderRadius(index))
	})

	return (
		<mesh
			ref={meshRef}
			geometry={geometry}
			material={material}
			scale={frame.renderRadius(index)}
			{...handlers}
		/>
	)
}

export default Rings
