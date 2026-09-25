import type { FC } from "react"
import { Box } from "@mantine/core"
import { CornerBar } from "@/features/help/HelpButton"

import LeftSection from "./LeftSection"
import Scene from "../THREE/Scene"
import classes from "./Hero.module.css"

export type HeroProps = Record<string, never>

const Hero: FC<HeroProps> = () => {
	return (
		<Box className={classes.root}>
			<CornerBar />
			<LeftSection />

			<Scene />
		</Box>
	)
}

export default Hero
