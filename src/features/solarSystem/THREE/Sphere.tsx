import * as React from "react"
import { useTexture } from "@react-three/drei"

type SphereProps = {
	texturePath: string
	posX: number
	posY: number
	posZ: number
	scale: number
}

// Loading the texture suspends this component, so it lives below the
// Suspense boundary that Sphere provides: each sphere pops in on its own
// once its texture has loaded.
const TexturedSphere: React.FC<SphereProps> = ({
	texturePath,
	posX,
	posY,
	posZ,
	scale,
}) => {
	const map = useTexture(texturePath)

	return (
		<mesh scale={[scale, scale, scale]} position={[posX, posY, posZ]}>
			<sphereGeometry args={[5, 64, 64]} />
			<meshBasicMaterial map={map} />
		</mesh>
	)
}

const Sphere: React.FC<SphereProps> = (props) => (
	<React.Suspense fallback={null}>
		<TexturedSphere {...props} />
	</React.Suspense>
)

export default Sphere
