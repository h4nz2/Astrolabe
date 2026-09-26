/**
 * One body: a group placed every frame from the SimFrame, oriented by the IAU
 * pole (local +Y; the pole frame of ./orientation.ts) and a mesh inside it spun
 * about that pole by `bodySpinAngle` (spin mode and tidal locking included). The texture loads
 * lazily behind a Suspense boundary with a plain coloured fallback material; a moon's map is
 * not even requested until the moon is drawn a few pixels wide (./surfaceLoad.ts, #37), and
 * until then it is drawn in the map's mean colour.
 * The Sun is emissive (Bloom arrives in Phase 6); every other body is lit by
 * it through the sunlight model (../lighting, docs/ARCHITECTURE.md, "Lighting"),
 * whose uniforms this component rewrites every frame. A ringed planet's rings
 * (../rings/Rings.tsx) sit in the pole frame and share those uniforms.
 */
import { Suspense, useMemo, useRef, useState } from "react"
import { useTexture } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import {
	PerspectiveCamera,
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
import Rings from "../rings/Rings"
import { useRingTextures } from "../rings/ringTextures"
import { pixelsPerUnitAtDistanceOne } from "../scene/picking"
import { useSimFrame } from "../scene/simFrame"
import { isDiscVisible } from "./moonOrbitFade"
import { bodyOrientation, bodySpinAngle, createBodySpin } from "./orientation"
import { setShown } from "./shown"
import { wantsSurface } from "./surfaceLoad"

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

function MappedMaterial({ body, uniforms }: MaterialProps) {
	const { base, night } = body.textures
	const urls =
		night === undefined ? [assetUrl(base)] : [assetUrl(base), assetUrl(night)]
	const [map, nightMap] = useTexture(urls, markSRGBAll)
	// a ringed planet carries its rings' shadow band (#12), unless its rings
	// are drawn far more opaque than they are (Jupiter's, Neptune's)
	const ringTextures = useRingTextures(body.rings)
	const ringShadow = useMemo(
		() =>
			ringTextures === null ||
			body.rings === null ||
			body.rings.castsShadow === false
				? undefined
				: {
						color: ringTextures.color,
						innerRadiusKm: body.rings.innerRadiusKm,
						outerRadiusKm: body.rings.outerRadiusKm,
					},
		[ringTextures, body.rings],
	)
	return (
		<SunlitMaterial
			uniforms={uniforms}
			color={body.appearance?.tint}
			map={map}
			nightMap={nightMap}
			ringShadow={ringShadow}
		/>
	)
}

/**
 * The colour map (times the curated tint, #17); a veiled body (Titan: its
 * surface is hidden by haze in visible light) is its tint alone.
 */
function TexturedMaterial({ body, uniforms }: MaterialProps) {
	if (body.appearance?.veiled) {
		return <SunlitMaterial uniforms={uniforms} color={body.appearance.tint} />
	}
	return <MappedMaterial body={body} uniforms={uniforms} />
}

function FallbackMaterial({ body, uniforms }: MaterialProps) {
	if (body.kind === "star") {
		return <meshBasicMaterial color="#ffb347" toneMapped={false} />
	}
	return (
		<SunlitMaterial
			uniforms={uniforms}
			color={
				body.appearance?.veiled
					? body.appearance.tint
					: (body.appearance?.color ?? "#5b6472")
			}
		/>
	)
}

function BodyMesh({ body, index }: BodyMeshProps) {
	const frame = useSimFrame()
	const groupRef = useRef<Group>(null)
	const meshRef = useRef<Mesh>(null)
	// a moon's map is fetched once it is near enough to show (#37); then it stays
	const [surfaceWanted, setSurfaceWanted] = useState(body.kind !== "moon")
	const surfaceWantedRef = useRef(surfaceWanted)
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

	useFrame(({ camera, size }) => {
		const group = groupRef.current
		const mesh = meshRef.current
		if (group === null || mesh === null) return
		frame.renderPosition(index, group.position)
		// a moon drawn smaller than a pixel is skipped: its marker dot shows
		// where it is, and 150 invisible spheres would cost the frame (#17)
		if (body.kind === "moon" && camera instanceof PerspectiveCamera) {
			const radius = frame.renderRadius(index)
			const distance = group.position.distanceTo(camera.position)
			const pxPerUnit = pixelsPerUnitAtDistanceOne(camera, size.height)
			setShown(group, isDiscVisible(radius, distance, pxPerUnit))
			if (
				!surfaceWantedRef.current &&
				wantsSurface(radius, distance, pxPerUnit)
			) {
				surfaceWantedRef.current = true
				setSurfaceWanted(true)
			}
		} else {
			setShown(group, true)
		}
		if (!group.visible) return
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
				{surfaceWanted ? (
					<Suspense
						fallback={<FallbackMaterial body={body} uniforms={uniforms} />}
					>
						{body.kind === "star" ? (
							<StarMaterial body={body} />
						) : (
							<TexturedMaterial body={body} uniforms={uniforms} />
						)}
					</Suspense>
				) : (
					<FallbackMaterial body={body} uniforms={uniforms} />
				)}
			</mesh>
			{body.rings !== null && (
				// in the pole frame: the rings follow the tilt, never the spin (#12, #13)
				<Suspense fallback={null}>
					<Rings
						rings={body.rings}
						radiusKm={body.radiusKm}
						index={index}
						uniforms={uniforms}
						bodyId={body.id}
					/>
				</Suspense>
			)}
		</group>
	)
}

export default BodyMesh
