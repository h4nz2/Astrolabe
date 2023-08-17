import * as React from "react"
import { Box, createStyles } from "@mantine/core"

import HUDLabel from "./HUDLabel"
import type { SolarDictionaryQuery } from "generated/graphql"

import { useGetHUDLabels } from "../hooks/useGetHUDLabels"
import Scene from "../THREE/Scene"

import { OurButton } from "./SliderArrow"

const useStyles = createStyles((theme) => ({
	base: {
		width: "100%",
		height: "100vh",
	},
	container: {
		position: "absolute",
		top: "10vw",
		left: "5vw",
		fontFamily: "arial",
		width: "20%",
		display: "flex",
		flexDirection: "column",
		zIndex: 1,

		[`@media (max-width: ${theme.breakpoints.xs}px)`]: {
			top: "15vw",
		},

		[`@media (max-width: ${theme.breakpoints.sm}px)`]: {
			top: "20vw",
		},
	},

	sliderContainer: {
		transform: "rotate(-90deg)",
		position: "absolute",
		top: "-140px",
		right: "50%",
		zIndex: 2,
		padding: "2.5px",
	},
	sliderItem: {
		width: "16px",
		height: "16px",
		backgroundColor: "gray",
		marginBottom: "25px",
		borderRadius: "100%",
		cursor: "pointer",
		position: "relative",

		"&:before": {
			content: "''",
			display: "block",
			position: "absolute",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			borderRadius: "100%",
			border: "2px solid rgba(255, 255, 255, 0.2)",
			opacity: 0,
			transition:
				"opacity 0.2s ease-in, width 0.3s ease-in, height 0.3s ease-in",

			width: "100%",
			height: "100%",
		},
		"&.isActive": {
			backgroundColor: "white",
			"&:before": {
				opacity: 1,
				width: "250%",
				height: "250%",
			},
		},
	},
}))

export type HUDProps = {
	solarDict: SolarDictionaryQuery["solarDictionary"]
	activeEntityIndex: number
	handleChangeActiveEntity: (newIndex: number) => void
}

const HUD: React.FC<HUDProps> = ({
	solarDict,
	activeEntityIndex,
	handleChangeActiveEntity,
}) => {
	const { classes, cx } = useStyles()

	const requiredLabelsSun = ["name", "diameter", "gravity", "avgTemp"]

	const requiredLabels = [
		"name",
		"diameter",
		"lengthOfDay",
		"orbitalPeriod",
		"gravity",
		"avgTemp",
	]

	const labels = useGetHUDLabels(
		solarDict[activeEntityIndex],
		!activeEntityIndex ? requiredLabelsSun : requiredLabels,
	)
	const HUDLabels = labels.map((label) =>
		Object.entries(label).map(
			([key, value], i) =>
				value && (
					<HUDLabel
						key={key}
						label={key}
						text={value[0]}
						extra={activeEntityIndex === 3 ? null : value[1]}
						small={!/name/i.test(key)}
					/>
				),
		),
	)

	const handlePrevBtnClick = () => {
		handleChangeActiveEntity(activeEntityIndex - 1)
	}
	const handleNextBtnClick = () => {
		handleChangeActiveEntity(activeEntityIndex + 1)
	}

	return (
		<Box className={classes.base}>
			{solarDict.map((entity, i) => (
				<Box key={i} hidden={i !== activeEntityIndex} sx={{ height: "100%" }}>
					<Scene baseTexture={entity.textures?.base!} />
					<Box className={classes.container}>{HUDLabels}</Box>
				</Box>
			))}
			<OurButton
				prev
				disabled={activeEntityIndex === 0}
				onClick={handlePrevBtnClick}
			/>
			<Box className={classes.sliderContainer}>
				{solarDict.map((_, i) => (
					<Box
						component="div"
						className={cx(classes.sliderItem, {
							isActive: i === activeEntityIndex,
						})}
						key={i}
						onClick={() => handleChangeActiveEntity(i)}
					/>
				))}
			</Box>
			<OurButton
				disabled={activeEntityIndex === solarDict.length - 1}
				onClick={handleNextBtnClick}
			/>
		</Box>
	)
}

export default HUD
