import dynamic from "next/dynamic"
import * as React from "react"

import { Stats } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"

import { useIsMobile } from "@/hooks/useIsMobile"

const Sun = dynamic(() => import("./Sphere"), { ssr: false })
const Effects = dynamic(() => import("../THREE/Effects"), { ssr: false })
import sun from "../../../../public/assets/textures/sun/sun.jpg"

export const Scene: React.FC = () => {
	const isMobile = useIsMobile()
	return (
		<Canvas
			dpr={isMobile ? 1 : 2}
			gl={{
				antialias: true,
				autoClear: true,
			}}
			// style={{ position: "absolute", top: 0, left: 0, right: 0 }}
		>
			<Sun texture={sun.src} />
			<Effects />
			{process.env.NODE_ENV === "development" ? <Stats /> : null}
		</Canvas>
	)
}

export default Scene
