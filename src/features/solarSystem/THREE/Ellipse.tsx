import { Line } from "@react-three/drei"
import { SolarDictionaryItem } from "generated/graphql"
import * as React from "react"
import { EllipseCurve } from "three"

export type EllipseProps = {
	entity: SolarDictionaryItem
	scaleBase: number
}

const Ellipse: React.FC<EllipseProps> = ({ entity, scaleBase }) => {
	const eccentricity = entity.eccentricity ?? 1
	const semimajorAxis = entity.semimajorAxis ?? 1
	const perihelion = entity.perihelion ?? 1
	const aX = semimajorAxis - perihelion
	const c = eccentricity * semimajorAxis
	const semiminorAxis = (c ** 2 + semimajorAxis ** 2) ** 0.5

	const curve = new EllipseCurve(
		aX / scaleBase,
		0, // ax, aY
		semimajorAxis / scaleBase,
		semiminorAxis / scaleBase, // xRadius, yRadius
		0,
		2 * Math.PI, // aStartAngle, aEndAngle
		false, // aClockwise
		0, // aRotation
	)

	const points = curve.getPoints(100)
	const points3D: [number, number, number][] = points.map((point) => [
		point.x,
		0,
		point.y,
	])

	return (
		<mesh>
			<Line points={points3D} linewidth={0.5} color={0xffffff} />
		</mesh>
	)
}

export default Ellipse
