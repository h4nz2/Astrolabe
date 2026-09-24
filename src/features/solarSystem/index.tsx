import * as React from "react"
import {
	Box,
	Center,
	Checkbox,
	Container,
	Anchor,
	Slider,
	Text,
} from "@mantine/core"
import { useSolarDictionary } from "@/data/solarDictionary"
import Loader from "@/primitives/Loader"
import Scene from "./THREE/Scene"
import { useState } from "react"

import {
	IconPlanet,
	IconSun,
	IconCircleDashed,
	IconInfoCircle,
} from "@tabler/icons-react"

import classes from "./SolarSystem.module.css"

const plantsScaleMarks = [
	{ value: 1, label: 1 },
	{ value: 25, label: 25 },
	{ value: 100, label: 100 },
	{ value: 500, label: 500 },
]

const SolarSystem: React.FC = () => {
	const { data: solarDict, loading } = useSolarDictionary()
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
						icon={({ className }) => <IconSun className={className} />}
						checked={showSun}
						onChange={() => setShowSun(!showSun)}
						size={"lg"}
						color={"orange.7"}
					/>
					<Checkbox
						icon={({ className }) => <IconPlanet className={className} />}
						checked={showPlanets}
						onChange={() => setShowPlanets(!showPlanets)}
						size={"lg"}
						color={"orange.7"}
					/>
					<Checkbox
						icon={({ className }) => <IconCircleDashed className={className} />}
						checked={showOrbits}
						onChange={() => setShowOrbits(!showOrbits)}
						size={"lg"}
						color={"orange.7"}
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
								<Text ta="center">
									Red Giant
									<br />
									{sunScale === 20 ? (
										<Anchor
											href="https://bigthink.com/starts-with-a-bang/big-sun-grow/"
											target="_blank"
											rel="noopener noreferrer"
											c="orange"
											pos="relative"
											top="-5.5rem"
										>
											<IconInfoCircle size={24} />
										</Anchor>
									) : null}
								</Text>
							),
						},
					]}
					thumbSize={36}
					thumbChildren={<IconSun size={22} />}
					size={"lg"}
					mb={"3rem"}
					color={"orange.7"}
					classNames={{ markLabel: classes.markLabel }}
				/>
				<Slider
					onChange={(value: number) => setPlanetScale(value)}
					min={1}
					max={500}
					marks={plantsScaleMarks}
					step={5}
					thumbSize={36}
					thumbChildren={<IconPlanet size={22} />}
					size={"lg"}
					color={"orange.7"}
					classNames={{ markLabel: classes.markLabel }}
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
