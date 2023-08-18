import * as React from "react"
import {
	Box,
	Center,
	Checkbox,
	CheckboxProps,
	Container,
	createStyles,
} from "@mantine/core"
import { useSolarDictionaryQuery } from "generated/graphql"
import Loader from "@/primitives/Loader"
import Scene from "../THREE/Scene"
import { useState } from "react"

import { Slider } from "@mantine/core"

import { Planet, Sun, CircleDashed } from "tabler-icons-react"

export type UniverseProps = {}

const useStyles = createStyles(() => ({
	base: {
		width: "100vw",
		height: "100vh",

		overflow: "hidden",
	},

	checkBoxContainer: {
		display: "flex",
		flexDirection: "row",
		gap: "24px",
		padding: "24px 12px",
	},

	sliderContainer: {
		display: "flex",
		flexDirection: "column",
		gap: "24px",
		padding: "24px 12px",
	},
}))

const Universe: React.FC<UniverseProps> = () => {
	const { classes } = useStyles()
	const { data, loading } = useSolarDictionaryQuery()
	const solarDict = data?.solarDictionary
	const [showSun, setShowSun] = useState(true)
	const [showPlanets, setShowPlanets] = useState(true)
	const [showOrbits, setShowOrbits] = useState(true)
	const [planetsScale, setPlanetScale] = useState(1)
	const [sunScale, setSunScale] = useState(1)

	const handleShowSun = () => {
		setShowSun(!showSun)
	}
	const handleShowPlanets = () => {
		setShowPlanets(!showPlanets)
	}
	const handleShowOrbits = () => {
		setShowOrbits(!showOrbits)
	}

	const updatePlanetsScale = (value: number) => {
		setPlanetScale(value)
	}

	const updateSunScale = (value: number) => {
		setSunScale(value)
	}

	if (!solarDict || loading) return <Loader />

	const plantsScaleMarks = [
		{ value: 1, label: 1 },
		{ value: 25, label: 25 },
		{ value: 100, label: 100 },
		{ value: 500, label: 500 },
	]
	return (
		<Box className={classes.base}>
			<Center>
				<Container fluid className={classes.checkBoxContainer}>
					<Checkbox
						icon={CheckboxSun}
						checked={showSun}
						onChange={handleShowSun}
					/>
					<Checkbox
						icon={CheckboxPlanet}
						checked={showPlanets}
						onChange={handleShowPlanets}
					/>
					<Checkbox
						icon={CheckboxOrbit}
						checked={showOrbits}
						onChange={handleShowOrbits}
					/>
				</Container>
			</Center>

			<Container fluid className={classes.sliderContainer}>
				<Slider
					onChange={updateSunScale}
					min={1}
					max={50}
					thumbSize={26}
					thumbChildren={<Sun size={16} />}
				/>
				<Slider
					onChange={updatePlanetsScale}
					min={1}
					max={500}
					marks={plantsScaleMarks}
					step={5}
					thumbSize={26}
					thumbChildren={<Planet size={16} />}
				/>
			</Container>

			<Scene
				planets={solarDict}
				planetsScale={planetsScale}
				sunScale={sunScale}
				showOrbits={showOrbits}
				showPlanets={showPlanets}
				showSun={showSun}
			/>
		</Box>
	)
}

export default Universe

const CheckboxSun: CheckboxProps["icon"] = ({ className }) => (
	<Sun className={className} />
)

const CheckboxPlanet: CheckboxProps["icon"] = ({ className }) => (
	<Planet className={className} />
)

const CheckboxOrbit: CheckboxProps["icon"] = ({ className }) => (
	<CircleDashed className={className} />
)
