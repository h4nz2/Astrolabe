import * as React from "react"
import {
	Box,
	Center,
	Checkbox,
	Container,
	createStyles,
	Anchor,
	Text,
} from "@mantine/core"
import { useSolarDictionaryQuery } from "generated/graphql"
import Loader from "@/primitives/Loader"
import Scene from "./THREE/Scene"
import { useState } from "react"

import { Slider } from "@mantine/core"

import { Planet, Sun, CircleDashed, InfoCircle } from "tabler-icons-react"

export type SolarSystemProps = {}

const useStyles = createStyles(() => ({
	base: {
		width: "100vw",
		height: "100vh",
		overflow: "hidden",
	},

	checkBoxContainer: {
		display: "flex",
		flexDirection: "row",
		gap: "2rem",
		padding: "2rem 0 0",
	},

	sliderContainer: {
		display: "flex",
		flexDirection: "column",
		padding: "2rem 1rem",
		".solr-Slider-markLabel": {
			paddingTop: "0.5rem",
		},
	},
}))

const plantsScaleMarks = [
	{ value: 1, label: 1 },
	{ value: 25, label: 25 },
	{ value: 100, label: 100 },
	{ value: 500, label: 500 },
]

const SolarSystem: React.FC<SolarSystemProps> = () => {
	const { classes } = useStyles()
	const { data, loading } = useSolarDictionaryQuery()
	const solarDict = data?.solarDictionary
	const [showSun, setShowSun] = useState(true)
	const [showPlanets, setShowPlanets] = useState(true)
	const [showOrbits, setShowOrbits] = useState(true)
	const [planetsScale, setPlanetScale] = useState(1)
	const [sunScale, setSunScale] = useState(1)

	if (!solarDict || loading) return <Loader />
	return (
		<Box className={classes.base}>
			<Center>
				<Container fluid className={classes.checkBoxContainer}>
					<Checkbox
						icon={({ className }) => <Sun className={className} />}
						checked={showSun}
						onChange={() => setShowSun(!showSun)}
						size={"lg"}
					/>
					<Checkbox
						icon={({ className }) => <Planet className={className} />}
						checked={showPlanets}
						onChange={() => setShowPlanets(!showPlanets)}
						size={"lg"}
					/>
					<Checkbox
						icon={({ className }) => <CircleDashed className={className} />}
						checked={showOrbits}
						onChange={() => setShowOrbits(!showOrbits)}
						size={"lg"}
					/>
				</Container>
			</Center>

			<Container fluid className={classes.sliderContainer}>
				<Slider
					onChange={(value: number) => setSunScale(value)}
					min={1}
					max={50}
					marks={[
						{
							value: 20,
							label: (
								<Text sx={{ textAlign: "center" }}>
									Red Giant
									<br />
									{sunScale === 20 ? (
										<Anchor
											href="https://bigthink.com/starts-with-a-bang/big-sun-grow/"
											target="_blank"
											rel="noopener noreferrer"
											sx={{
												position: "relative",
												top: "-5.5rem",
											}}
										>
											<InfoCircle size={24} />
										</Anchor>
									) : null}
								</Text>
							),
						},
					]}
					thumbSize={36}
					thumbChildren={<Sun size={22} />}
					size={"lg"}
					mb={"3rem"}
				/>
				<Slider
					onChange={(value: number) => setPlanetScale(value)}
					min={1}
					max={500}
					marks={plantsScaleMarks}
					step={5}
					thumbSize={36}
					thumbChildren={<Planet size={22} />}
					size={"lg"}
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

export default SolarSystem
