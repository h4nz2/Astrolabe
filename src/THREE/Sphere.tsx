import { useFrame } from "@react-three/fiber"
import * as React from "react"
import type { Mesh, MeshBasicMaterial } from "three"

import {
	EffectComposer,
	DepthOfField,
	Noise,
	Glitch,
} from "@react-three/postprocessing"
import { GlitchMode } from "postprocessing"

import { BlendFunction } from "postprocessing"
import {
	ContactShadows,
	PerspectiveCamera,
	useTexture,
} from "@react-three/drei"
import * as THREE from "three"

import { a } from "@react-spring/three"
import CircleLens from "./effects/CircleLens"
import { useWindowSize } from "@/hooks/useWindowSize"

const Sphere = () => {
	const mesh = React.useRef<Mesh>(null!)
	const matRef = React.useRef<MeshBasicMaterial>(null!)

	const [hovered, setHovered] = React.useState(false)

	useFrame((state) => {
		if (mesh.current) {
			mesh.current.position.x = THREE.MathUtils.lerp(
				mesh.current.position.x,
				hovered ? state.mouse.x / 1 : 0,
				0.2,
			)
			mesh.current.position.y = THREE.MathUtils.lerp(
				mesh.current.position.y,
				Math.sin(state.clock.elapsedTime / 0.5) / 2 +
					(hovered ? state.mouse.y / 1 : 0),
				0.005,
			)
		}
	})
	const texturePath = "assets/textures/sun_detailed.jpg"

	return (
		<>
			<PerspectiveCamera makeDefault position={[0, 0, 5]} fov={60} />
			<React.Suspense fallback={null}>
				<a.mesh
					ref={mesh}
					onPointerOver={() => setHovered(true)}
					onPointerOut={() => setHovered(false)}
					scale={[0.2, 0.2, 0.2]}
				>
					<sphereGeometry args={[5, 64, 64]} />
					<meshBasicMaterial
						ref={matRef}
						attach="material"
						map={useTexture(texturePath)}
					/>
				</a.mesh>
				<ContactShadows
					rotation={[Math.PI / 2, 0, 0]}
					position={[0, -1.03, 0]}
					opacity={0.85}
					color={"orange"}
					width={6}
					height={6}
					blur={3.5}
					far={2.6}
				/>
			</React.Suspense>
		</>
	)
}

export default Sphere

export const Effects: React.FC = () => {
	const { height } = useWindowSize()

	return (
		<EffectComposer multisampling={0}>
			<DepthOfField
				focusDistance={0.31}
				focalLength={0.05}
				bokehScale={1.1}
				height={height}
				blendFunction={BlendFunction.AVERAGE}
				blur={1}
			/>

			<Glitch
				delay={new THREE.Vector2(5.5, 2.5)}
				duration={new THREE.Vector2(0.1, 0.5)}
				strength={new THREE.Vector2(0.01, 0.02)}
				mode={GlitchMode.SPORADIC}
				active
				ratio={0.1}
			/>

			<Noise opacity={0.425} />
			<CircleLens fragments={7} />
		</EffectComposer>
	)
}
