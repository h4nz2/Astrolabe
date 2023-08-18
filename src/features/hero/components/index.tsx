import dynamic from "next/dynamic"
import * as React from "react"
import { createStyles, Box } from "@mantine/core"

import LeftSection from "./LeftSection"
import Scene from "../THREE/Scene"

export type HeroProps = {}

const useStyles = createStyles((theme) => ({
	root: {
		paddingTop: `calc(${theme.spacing.xl} * 15)`,
		paddingBottom: `calc(${theme.spacing.xl} * 5)`,
		height: "100vh",
	},
}))

const Hero: React.FC<HeroProps> = () => {
	const { classes } = useStyles()
	return (
		<Box className={classes.root}>
			<LeftSection />
			<Scene />
		</Box>
	)
}

export default Hero
