import dynamic from "next/dynamic"
import * as React from "react"
import { Canvas } from "@react-three/fiber"

import { SolarDictionaryItem } from "generated/graphql"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import Ellipse from "./Ellipse"
import Planet from "../components/Planet"

const Sphere = dynamic(() => import("@/features/solarSystem/THREE/Sphere"), {
	ssr: false,
})

type SceneProps = {
	planets: Array<SolarDictionaryItem>
	planetsScale: number
	showOrbits: boolean
	showPlanets: boolean
	showSun: boolean
	sunScale: number
}

export const Scene: React.FC<SceneProps> = ({
	planets,
	planetsScale = 1,
	showOrbits,
	showPlanets,
	showSun,
	sunScale = 1,
}) => {
	const sun = planets[0]
	const scaleBase = sun.diameter
	const planetScale = scaleBase / planetsScale
	const planetsOffset = 3
	const orbitalPeriodScale = planets[3].orbitalPeriod

	return (
		<Canvas dpr={2} gl={{ antialias: false }}>
			<PerspectiveCamera
				makeDefault
				far={100000}
				position={[(planets.length / 2) * planetsOffset, 10000, 35000]}
				fov={5}
			/>
			<OrbitControls
				autoRotate={false}
				autoRotateSpeed={1}
				enablePan={false}
				enableZoom={true}
				maxDistance={90000}
				minDistance={250}
			/>
			{showSun ? (
				<Sphere
					texturePath={sun?.textures?.base!}
					posX={0}
					posY={0}
					posZ={0}
					scale={(sun.diameter * sunScale) / scaleBase}
				/>
			) : null}
			{showPlanets
				? planets
						.slice(1)
						.map((entity, i) => (
							<Planet
								key={i}
								index={i}
								scaleBase={scaleBase}
								planetScale={planetScale}
								entity={entity}
								orbitalPeriodScale={orbitalPeriodScale ?? 365}
							/>
						))
				: null}
			{showOrbits
				? planets
						.slice(1)
						.map((entity, i) => (
							<Ellipse key={i} entity={entity} scaleBase={scaleBase}></Ellipse>
						))
				: null}
		</Canvas>
	)
}

export default Scene
