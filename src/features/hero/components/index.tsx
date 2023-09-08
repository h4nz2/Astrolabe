import dynamic from "next/dynamic"
import { FC } from "react"
import { createStyles, Box } from "@mantine/core"

import LeftSection from "./LeftSection"

const Scene = dynamic(() => import("../THREE/Scene"), { ssr: false })

export type HeroProps = {}

const useStyles = createStyles((theme) => ({
	root: {
		paddingTop: theme.spacing.xl,
		height: "100vh",
		background: theme.colors.dark[7],
		display: "flex",
		flexDirection: "column",
		justifyContent: "start",
		alignItems: "start",
	},
}))

const Hero: FC<HeroProps> = () => {
	const { classes } = useStyles()
	return (
		<Box className={classes.root}>
			<LeftSection />

			<Scene />
		</Box>
	)
}

export default Hero
