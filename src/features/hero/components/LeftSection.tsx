import type { FC } from "react"
import { Link } from "@tanstack/react-router"
import type { LinkProps } from "@tanstack/react-router"
import {
	Container,
	Title,
	Text,
	Button as MantineButton,
	Box,
	Flex,
} from "@mantine/core"

import ScaleInOut from "@/GSAPAnimation/ScaleInOut"
import classes from "./LeftSection.module.css"

export type LeftSectionProps = Record<string, never>

const LeftSection: FC<LeftSectionProps> = () => {
	return (
		<Container w="100%">
			<Text component="div" className={classes.klassenLager}>
				<ScaleInOut delay={1} skipOutro={false}>
					Made with love by odi and hrj
				</ScaleInOut>
			</Text>
			<Box className={classes.content}>
				<Text
					component="span"
					variant="gradient"
					className={classes.title}
					gradient={{ from: "red", to: "yellow" }}
					style={{ fontWeight: 600 }}
				>
					Solr
				</Text>
				<Title className={classes.title}>To the stars! </Title>
				<Flex direction="column" py="xl" gap="xs" maw={300}>
					<Button to="/solar_dictionary" label="Dictionary" />
					<Button to="/solar_system" label="Solar Model" />
				</Flex>
			</Box>
		</Container>
	)
}
export default LeftSection

type ButtonProps = { to: LinkProps["to"]; label: string }

const Button: FC<ButtonProps> = ({ to, label }) => {
	return (
		<MantineButton
			component={Link}
			to={to}
			preload="viewport"
			variant="gradient"
			gradient={{ from: "yellow", to: "red" }}
			size="xl"
			className={classes.button}
		>
			{label}
		</MantineButton>
	)
}
