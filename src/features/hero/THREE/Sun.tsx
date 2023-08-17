import { useFrame } from "@react-three/fiber"
import * as React from "react"
import type { Mesh, MeshBasicMaterial } from "three"

import {
	ContactShadows,
	PerspectiveCamera,
	useTexture,
} from "@react-three/drei"
import { MathUtils } from "three"
import sun from "../../../../public/assets/textures/sun_detailed.jpg"
import { a } from "@react-spring/three"

const Sun = () => {
	const mesh = React.useRef<Mesh>(null!)
	const matRef = React.useRef<MeshBasicMaterial>(null!)

	const [hovered, setHovered] = React.useState(false)

	useFrame((state) => {
		if (mesh.current) {
			mesh.current.position.x = MathUtils.lerp(
				mesh.current.position.x,
				hovered ? state.mouse.x / 1 : 0,
				0.2,
			)
			mesh.current.position.y = MathUtils.lerp(
				mesh.current.position.y,
				Math.sin(state.clock.elapsedTime / 0.5) / 2 +
					(hovered ? state.mouse.y / 1 : 0),
				0.005,
			)
		}
	})

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
						map={useTexture(sun.src)}
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

export default Sun
