import * as React from "react"

import { Stats } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"

import { useIsMobile } from "@/hooks/useIsMobile"
import { assetUrl } from "@/utils/assetUrl"
import Sun from "./Sphere"
import Effects from "./Effects"

// served from public/ (Vite copies it next to index.html; assetUrl honours VITE_BASE)
const SUN_TEXTURE = assetUrl("assets/textures/sun/sun.jpg")

export const Scene: React.FC = () => {
	const isMobile = useIsMobile()
	return (
		<Canvas
			dpr={isMobile ? 1 : 2}
			gl={{
				antialias: true,
				autoClear: true,
			}}
		>
			<Sun texture={SUN_TEXTURE} />
			<Effects />
			{import.meta.env.DEV ? <Stats /> : null}
		</Canvas>
	)
}

export default Scene
