import { Suspense, type FC } from "react"

import { OrbitControls, PerspectiveCamera, Stats } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"

import { useIsMobile } from "@/hooks/useIsMobile"
import Sphere from "./Sphere"

export type SceneProps = {
	texture?: string
}

export const Scene: FC<SceneProps> = ({ texture }) => {
	const isMobile = useIsMobile()
	return (
		<Canvas dpr={isMobile ? 1 : 2} gl={{ antialias: false }}>
			{/* camera and controls stay outside the Suspense so they are live from the first
			    frame; only the textured sphere waits for its download */}
			<PerspectiveCamera makeDefault position={[0, 0, 5]} fov={60} />
			<Suspense fallback={null}>
				{texture ? <Sphere texture={texture} /> : null}
			</Suspense>
			<OrbitControls
				autoRotate
				autoRotateSpeed={2}
				enablePan={false}
				enableZoom={true}
				minDistance={3}
				maxDistance={8}
			/>
			{import.meta.env.DEV ? <Stats /> : null}
		</Canvas>
	)
}

export default Scene
