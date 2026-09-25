/**
 * One body: a group placed every frame from the SimFrame, oriented by the IAU
 * pole (local +Y; the pole frame of ./orientation.ts) and a mesh inside it spun
 * about that pole by `bodySpinAngle` (spin mode and tidal locking included). The texture loads
 * lazily behind a Suspense boundary with a plain coloured fallback material.
 * The Sun is emissive (Bloom arrives in Phase 6); every other body is lit by
 * it through the sunlight model (../lighting, docs/ARCHITECTURE.md, "Lighting"),
 * whose uniforms this component rewrites every frame.
 */
import { Suspense, useMemo, useRef } from "react"
import { useTexture } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import {
	SphereGeometry,
	SRGBColorSpace,
	type Group,
	type Mesh,
	type Texture,
} from "three"

import type { Body } from "@/data"
import { occluderCandidates, rootIndexOf } from "@/sim"
import { useLightingStore } from "@/store/lighting"
import { isBodyShown, useSimStore } from "@/store/sim"
import { assetUrl } from "@/utils/assetUrl"

import {
	createSunlightUniforms,
	updateSunlight,
	type SunlightUniforms,
} from "../lighting/bodyLighting"
import SunlitMaterial from "../lighting/SunlitMaterial"
import { useSimFrame } from "../scene/simFrame"
import { bodyOrientation, bodySpinAngle, createBodySpin } from "./orientation"

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
const markSRGBAll = (textures: Texture[]) => textures.forEach(markSRGB)

interface MaterialProps {
	body: Body
	uniforms: SunlightUniforms
}

function StarMaterial({ body }: { body: Body }) {
	const map = useTexture(assetUrl(body.textures.base), markSRGB)
	return <meshBasicMaterial map={map} toneMapped={false} />
}

function TexturedMaterial({ body, uniforms }: MaterialProps) {
	const { base, night } = body.textures
	const urls =
		night === undefined ? [assetUrl(base)] : [assetUrl(base), assetUrl(night)]
	const [map, nightMap] = useTexture(urls, markSRGBAll)
	return <SunlitMaterial uniforms={uniforms} map={map} nightMap={nightMap} />
}

function FallbackMaterial({ body, uniforms }: MaterialProps) {
	if (body.kind === "star") {
		return <meshBasicMaterial color="#ffb347" toneMapped={false} />
	}
	return <SunlitMaterial uniforms={uniforms} color="#5b6472" />
}

function BodyMesh({ body, index }: BodyMeshProps) {
	const frame = useSimFrame()
	const groupRef = useRef<Group>(null)
	const meshRef = useRef<Mesh>(null)
	const orientation = useMemo(() => bodyOrientation(body), [body])
	const spin = useMemo(
		() => createBodySpin(body, index, frame),
		[body, index, frame],
	)
	const sunIndex = useMemo(() => rootIndexOf(frame.bodies), [frame])
	const uniforms = useMemo(
		() => createSunlightUniforms(body, frame.bodies[sunIndex].radiusKm),
		[body, frame, sunIndex],
	)
	const casters = useMemo(
		() => occluderCandidates(frame.bodies, index),
		[frame, index],
	)
	// a hidden moon casts no shadow: a shadow without its caster reads as a bug
	const isCasterShown = useMemo(
		() => (j: number) => isBodyShown(frame.bodies[j], useSimStore.getState()),
		[frame],
	)

	useFrame(() => {
		const group = groupRef.current
		const mesh = meshRef.current
		if (group === null || mesh === null) return
		frame.renderPosition(index, group.position)
		// the drawn radius under the active scale (docs/ARCHITECTURE.md, "Scale")
		mesh.scale.setScalar(frame.renderRadius(index))
		mesh.rotation.y = bodySpinAngle(body, spin, frame)
		if (body.kind === "star") return
		updateSunlight(
			uniforms,
			frame,
			index,
			sunIndex,
			casters,
			isCasterShown,
			useLightingStore.getState().alwaysLit,
		)
	})

	return (
		<group ref={groupRef} quaternion={orientation}>
			<mesh
				ref={meshRef}
				geometry={unitSphere(sphereSegments(body))}
				scale={frame.renderRadius(index)}
			>
				<Suspense
					fallback={<FallbackMaterial body={body} uniforms={uniforms} />}
				>
					{body.kind === "star" ? (
						<StarMaterial body={body} />
					) : (
						<TexturedMaterial body={body} uniforms={uniforms} />
					)}
				</Suspense>
			</mesh>
		</group>
	)
}

export default BodyMesh
