import dynamic from "next/dynamic"
import * as React from "react"

import { Stats } from "@react-three/drei"
import { Canvas, Dpr } from "@react-three/fiber"
import { Effects } from "../THREE/Effects"

import { useIsMobile } from "@/hooks/useIsMobile"

const Sun = dynamic(() => import("../THREE/Sun"), { ssr: false })

export const Scene: React.FC = () => {
	const isMobile = useIsMobile()
	return (
		<Canvas dpr={isMobile ? 1 : 2} gl={{ antialias: true }}>
			<Sun />
			<Effects />
			{process.env.NODE_ENV === "development" && <Stats />}
		</Canvas>
	)
}

export default Scene
