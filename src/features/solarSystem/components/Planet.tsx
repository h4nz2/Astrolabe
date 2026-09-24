import * as React from "react"
import Sphere from "../THREE/Sphere"
import type { SolarDictionaryItem } from "@/data/solarDictionary"
import { useEffect, useState } from "react"

export type PlanetProps = {
	entity: SolarDictionaryItem
	scaleBase: number
	planetScale: number
	index: number
	orbitalPeriodScale: number
}

const Planet: React.FC<PlanetProps> = ({
	entity,
	scaleBase,
	planetScale,
	index,
	orbitalPeriodScale,
}) => {
	const eccentricity = (entity.eccentricity ?? 1) / scaleBase
	const semimajorAxis = (entity.semimajorAxis ?? 1) / scaleBase
	const perihelion = (entity.perihelion ?? 1) / scaleBase
	const orbitalPeriod = entity.orbitalPeriod ?? orbitalPeriodScale

	const offsetX = semimajorAxis - perihelion
	const c = eccentricity * semimajorAxis
	const semiminorAxis = (c ** 2 + semimajorAxis ** 2) ** 0.5

	const timeInterval = 25
	const msPerEarthYear = 10000
	const msPerYear = (orbitalPeriod / orbitalPeriodScale) * msPerEarthYear
	const anglePerInterval = 25 * ((Math.PI * 2) / msPerYear)

	const [posX, setPosX] = useState(-perihelion)
	const [poZ, setPoZ] = useState(0)
	const [angle, setAngle] = useState(0)

	useEffect(() => {
		const movement = setInterval(() => {
			const t = (angle % (Math.PI * 2)) - Math.PI
			const x = offsetX + semiminorAxis * Math.cos(t)
			const y = semimajorAxis * Math.sin(t)
			setPosX(x)
			setPoZ(y)
			setAngle(angle + anglePerInterval)
		}, timeInterval)

		return () => {
			clearInterval(movement)
		}
	}, [
		angle,
		offsetX,
		posX,
		poZ,
		semimajorAxis,
		semiminorAxis,
		anglePerInterval,
	])

	return (
		<Sphere
			key={index}
			texturePath={entity.textures!.base}
			posX={posX}
			posY={0}
			posZ={poZ}
			scale={entity.diameter / planetScale}
		/>
	)
}

export default Planet
