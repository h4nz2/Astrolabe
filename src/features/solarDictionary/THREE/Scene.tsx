import dynamic from "next/dynamic"
import type { FC } from "react"

import { OrbitControls, Stats } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"

import { useIsMobile } from "@/hooks/useIsMobile"

const Sphere = dynamic(() => import("./Sphere"), { ssr: false })

type SceneProps = {
	texture?: string | null
}

export const Scene: FC<SceneProps> = ({ texture }) => {
	const isMobile = useIsMobile()
	return (
		<Canvas dpr={isMobile ? 1 : 2} gl={{ antialias: false }}>
			{texture ? <Sphere texture={texture} /> : null}
			<OrbitControls
				autoRotate
				autoRotateSpeed={2}
				enablePan={false}
				enableZoom={true}
				minDistance={3}
				maxDistance={8}
			/>
			{process.env.NODE_ENV === "development" ? <Stats /> : null}
		</Canvas>
	)
}

export default Scene
