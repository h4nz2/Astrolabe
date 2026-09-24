/**
 * One body: a group placed every frame from the SimFrame, oriented by the IAU
 * pole (local +Y) and spun about it by `rotationAngle`. The texture loads
 * lazily behind a Suspense boundary with a plain coloured fallback material.
 * The Sun is emissive (Bloom arrives in Phase 6) and carries the point light.
 */
import { Suspense, useMemo, useRef } from "react"
import { useTexture } from "@react-three/drei"
import { useFrame, type ThreeEvent } from "@react-three/fiber"
import {
	SphereGeometry,
	SRGBColorSpace,
	type Group,
	type Mesh,
	type Texture,
} from "three"

import type { Body } from "@/data"
import { rotationAngle } from "@/sim"
import { useSimStore } from "@/store/sim"
import { assetUrl } from "@/utils/assetUrl"

import { useSimFrame } from "../scene/simFrame"
import { isTapEvent } from "../scene/tap"
import { bodyOrientation } from "./orientation"

export interface BodyMeshProps {
	body: Body
	index: number
}

/** Sphere detail per docs/ARCHITECTURE.md: 64 for the Sun and planets, 32 for moons, 16 for estimated radii. */
export const sphereSegments = (
	body: Pick<Body, "kind" | "radiusEstimated">,
): number => {
	if (body.kind !== "moon") return 64
	return body.radiusEstimated ? 16 : 32
}

// Unit spheres shared by every body of the same detail level; the mesh scales
// one to the body's drawn radius (frame.renderRadius), so 191 bodies use three geometries.
const unitSpheres = new Map<number, SphereGeometry>()
const unitSphere = (segments: number): SphereGeometry => {
	let geometry = unitSpheres.get(segments)
	if (geometry === undefined) {
		geometry = new SphereGeometry(1, segments, segments)
		unitSpheres.set(segments, geometry)
	}
	return geometry
}

// Colour maps are authored in sRGB; drei's useTexture leaves colorSpace alone.
const markSRGB = (texture: Texture) => {
	texture.colorSpace = SRGBColorSpace
}

function TexturedMaterial({ body }: { body: Body }) {
	const map = useTexture(assetUrl(body.textures.base), markSRGB)
	if (body.kind === "star") {
		return <meshBasicMaterial map={map} toneMapped={false} />
	}
	return <meshStandardMaterial map={map} roughness={1} metalness={0} />
}

function FallbackMaterial({ body }: { body: Body }) {
	if (body.kind === "star") {
		return <meshBasicMaterial color="#ffb347" toneMapped={false} />
	}
	return <meshStandardMaterial color="#5b6472" roughness={1} metalness={0} />
}

function BodyMesh({ body, index }: BodyMeshProps) {
	const frame = useSimFrame()
	const groupRef = useRef<Group>(null)
	const meshRef = useRef<Mesh>(null)
	const orientation = useMemo(() => bodyOrientation(body), [body])

	useFrame(() => {
		const group = groupRef.current
		const mesh = meshRef.current
		if (group === null || mesh === null) return
		frame.renderPosition(index, group.position)
		// the drawn radius under the active scale (docs/ARCHITECTURE.md, "Scale")
		mesh.scale.setScalar(frame.renderRadius(index))
		mesh.rotation.y = rotationAngle(body.rotation, frame.jd)
	})

	const onClick = (event: ThreeEvent<MouseEvent>) => {
		if (!isTapEvent(event)) return
		event.stopPropagation()
		useSimStore.getState().setFocus(body.id)
	}
	const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation()
		useSimStore.getState().setHover(body.id)
	}
	const onPointerOut = () => {
		const store = useSimStore.getState()
		if (store.hoverId === body.id) store.setHover(null)
	}

	return (
		<group ref={groupRef} quaternion={orientation}>
			<mesh
				ref={meshRef}
				geometry={unitSphere(sphereSegments(body))}
				scale={frame.renderRadius(index)}
				onClick={onClick}
				onPointerOver={onPointerOver}
				onPointerOut={onPointerOut}
			>
				<Suspense fallback={<FallbackMaterial body={body} />}>
					<TexturedMaterial body={body} />
				</Suspense>
			</mesh>
			{body.kind === "star" ? (
				<pointLight decay={0} intensity={2} color="white" />
			) : null}
		</group>
	)
}

export default BodyMesh
