/**
 * The Sun's corona (#41): a soft pearly glow around the Sun, drawn only while
 * the Moon covers the Sun as seen from the camera, which is when the real one
 * becomes visible. Without it a total solar eclipse seen from the Earth is a
 * black disc on a black sky; with it the Moon's silhouette reads at once.
 *
 * How much of the Sun is covered is measured from the camera, with the drawn
 * sizes and positions (`discOverlapArea`), so it follows the scene exactly:
 * from the path of totality at true scale it is the real eclipse. A billboard
 * behind the Moon (depth-tested, additive), with the logarithmic depth buffer
 * chunks like every other material.
 */
import { useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
	AdditiveBlending,
	type Camera,
	DoubleSide,
	Mesh,
	PlaneGeometry,
	ShaderMaterial,
	Vector3,
} from "three"

import { discOverlapArea } from "@/sim"

import { useSimFrame, type SimFrame } from "../scene/simFrame"

/** The corona's drawn radius, in the Sun's radii. */
export const CORONA_RADII = 6
/** The glow starts to show at this share of the Sun covered, and is full when it is all covered. */
export const CORONA_FROM = 0.97

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
	vUv = uv * 2.0 - 1.0;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	#include <logdepthbuf_vertex>
}
`

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uOpacity;
uniform float uSunRadius;
varying vec2 vUv;
void main() {
	#include <logdepthbuf_fragment>
	// r in the Sun's radii
	float r = length(vUv) / uSunRadius;
	if (r < 1.0) discard;
	float angle = atan(vUv.y, vUv.x);
	// a few soft streamers, brighter along the Sun's equator
	float streamers = 0.75 + 0.25 * cos(angle * 2.0) + 0.12 * cos(angle * 7.0 + 1.3);
	float glow = pow(max(r, 1.0), -2.6) * streamers;
	float edge = smoothstep(${CORONA_RADII.toFixed(1)}, ${(CORONA_RADII * 0.55).toFixed(1)}, r);
	gl_FragColor = vec4(vec3(0.92, 0.95, 1.0) * glow * edge * uOpacity, 1.0);
}
`

const scratchSun = new Vector3()
const scratchMoon = new Vector3()

/** Share (0..1) of the drawn Sun's disc the drawn Moon covers, seen from the camera at `eye` (render units). */
export function coveredShare(
	frame: SimFrame,
	eye: Vector3,
	sunIndex: number,
	moonIndex: number,
): number {
	const sun = frame.renderPosition(sunIndex, scratchSun).sub(eye)
	const moon = frame.renderPosition(moonIndex, scratchMoon).sub(eye)
	const sunDistance = sun.length()
	const moonDistance = moon.length()
	if (!(moonDistance < sunDistance) || moonDistance === 0) return 0
	const a = Math.asin(Math.min(frame.renderRadius(sunIndex) / sunDistance, 1))
	const b = Math.asin(Math.min(frame.renderRadius(moonIndex) / moonDistance, 1))
	const c = sun.angleTo(moon)
	return discOverlapArea(a, b, c) / (Math.PI * a * a)
}

/** One frame of the corona: its opacity from how much of the Sun the Moon covers, and its place. */
export function placeCorona(
	target: Mesh,
	material: ShaderMaterial,
	frame: SimFrame,
	camera: Camera,
	sunIndex: number,
	moonIndex: number,
): void {
	const covered = coveredShare(frame, camera.position, sunIndex, moonIndex)
	const opacity = Math.min(
		1,
		Math.max(0, (covered - CORONA_FROM) / (1 - CORONA_FROM)),
	)
	material.uniforms.uOpacity.value = opacity
	target.visible = opacity > 0
	if (!target.visible) return
	frame.renderPosition(sunIndex, target.position)
	target.quaternion.copy(camera.quaternion)
	target.scale.setScalar(frame.renderRadius(sunIndex) * CORONA_RADII)
}

const Corona = () => {
	const frame = useSimFrame()
	const camera = useThree((state) => state.camera)
	const mesh = useRef<Mesh>(null)
	const material = useMemo(
		() =>
			new ShaderMaterial({
				vertexShader,
				fragmentShader,
				uniforms: {
					uOpacity: { value: 0 },
					uSunRadius: { value: 1 / CORONA_RADII },
				},
				transparent: true,
				depthWrite: false,
				blending: AdditiveBlending,
				side: DoubleSide,
			}),
		[],
	)
	const geometry = useMemo(() => new PlaneGeometry(2, 2), [])
	const sunIndex = frame.index.get("sun") ?? 0
	const moonIndex = frame.index.get("moon")

	useFrame(() => {
		if (mesh.current === null || moonIndex === undefined) return
		placeCorona(mesh.current, material, frame, camera, sunIndex, moonIndex)
	})

	return (
		<mesh
			ref={mesh}
			geometry={geometry}
			material={material}
			visible={false}
			frustumCulled={false}
			renderOrder={-1}
		/>
	)
}

export default Corona
