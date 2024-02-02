import * as React from "react"
import { Box, createStyles } from "@mantine/core"

import StageLabel from "./StageLabel"
import type { SolarDictionaryQuery } from "generated/graphql"

import { useStageLabels } from "../hooks/useStageLabels"
import Scene from "../THREE/Scene"

import { useState } from "react"

import Navi from "./Navi"

const useStyles = createStyles({
	base: { width: "100%", height: "100vh" },
	container: {
		position: "fixed",
		top: "10rem",
		left: "2rem",
		fontFamily: "arial",
		width: "20ch",
		display: "flex",
		flexDirection: "column",
		zIndex: 10,
	},
})

export type StageProps = {
	solarDict: SolarDictionaryQuery["solarDictionary"]
	activeEntityIndex: number
	onChange: (newIndex: number) => void
}
const defaultTexture = "base"

const requiredLabelsSun = ["name", "diameter", "gravity", "avgTemp"]

const requiredLabels = [
	"name",
	"diameter",
	"lengthOfDay",
	"orbitalPeriod",
	"gravity",
	"avgTemp",
]

const Stage: React.FC<StageProps> = ({
	activeEntityIndex,
	onChange,
	solarDict,
}) => {
	const { classes } = useStyles()

	const labels = useStageLabels(
		solarDict[activeEntityIndex],
		!activeEntityIndex ? requiredLabelsSun : requiredLabels,
	)

	const [activeTexture, setActiveTexture] =
		useState<keyof NonNullable<(typeof solarDict)[number]["textures"]>>(
			defaultTexture,
		)
	return (
		<Box className={classes.base}>
			<Navi
				activeEntityIndex={activeEntityIndex}
				activeTexture={activeTexture}
				onChange={onChange}
				setActiveTexture={setActiveTexture}
				solarDict={solarDict}
			/>

			{solarDict.map(({ textures }, i) => {
				const texture = textures?.[activeTexture] ?? textures?.[defaultTexture]
				return (
					<Box
						key={i}
						hidden={i !== activeEntityIndex}
						sx={{ height: "100%", minWidth: "760px" }}
					>
						<Scene texture={texture} />
						<Box className={classes.container}>
							{labels.map((label) =>
								Object.entries(label).map(([label, value]) =>
									value ? (
										<StageLabel
											key={label}
											label={label}
											text={value[0]}
											extra={activeEntityIndex === 3 ? null : value[1]}
											small={!/name/i.test(label)}
										/>
									) : null,
								),
							)}
						</Box>
					</Box>
				)
			})}
		</Box>
	)
}

export default Stage
