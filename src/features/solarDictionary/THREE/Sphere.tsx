import { useRef, useState, type FC } from "react"
import { useFrame } from "@react-three/fiber"
import { ContactShadows, useTexture } from "@react-three/drei"
import { MathUtils, type Mesh } from "three"

export type SphereProps = {
	texture: string
}

const Sphere: FC<SphereProps> = ({ texture }) => {
	const mesh = useRef<Mesh>(null)
	const [hovered, setHovered] = useState(false)
	// suspends until the texture is loaded; the Suspense boundary lives in Scene
	const map = useTexture(texture)

	useFrame((state) => {
		if (mesh.current) {
			mesh.current.position.y = MathUtils.lerp(
				mesh.current.position.y,
				Math.sin(state.clock.elapsedTime / 0.5) / 2 +
					(hovered ? state.pointer.y / 1 : 0),
				0.005,
			)
		}
	})
	return (
		<>
			<mesh
				ref={mesh}
				onPointerOver={() => setHovered(true)}
				onPointerOut={() => setHovered(false)}
				scale={[0.2, 0.2, 0.2]}
			>
				<sphereGeometry args={[5, 64, 64]} />
				<meshBasicMaterial map={map} />
			</mesh>
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
		</>
	)
}

export default Sphere
