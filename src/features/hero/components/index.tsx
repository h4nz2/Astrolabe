import type { FC } from "react"
import { Box } from "@mantine/core"

import { LanguageMenu } from "@/i18n"

import LeftSection from "./LeftSection"
import Scene from "../THREE/Scene"
import classes from "./Hero.module.css"

export type HeroProps = Record<string, never>

const Hero: FC<HeroProps> = () => {
	return (
		<Box className={classes.root}>
			<LanguageMenu placement="corner" />
			<LeftSection />

			<Scene />
		</Box>
	)
}

export default Hero
