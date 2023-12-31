import { FC } from "react"
import Link from "next/link"
import {
	createStyles,
	Container,
	Title,
	Text,
	Button as MantineButton,
	Box,
	Flex,
} from "@mantine/core"

import ScaleInOut from "@/GSAPAnimation/ScaleInOut"

const useStyles = createStyles((theme) => ({
	content: {
		paddingTop: `calc(${theme.spacing.xl} * 2)`,
		paddingBottom: `calc(${theme.spacing.xl} * 2)`,
	},

	title: {
		color: theme.white,
		fontFamily: `Greycliff CF, ${theme.fontFamily}`,
		fontWeight: 900,
		lineHeight: 1.5,
		maxWidth: 500,
		fontSize: 48,
	},
	klassenLager: { fontSize: "12px", fontWeight: "bold", color: theme.white },
	button: {
		width: "100%",
		padding: "0 50px",
		fontFamily: `Greycliff CF, ${theme.fontFamily}`,
		fontSize: 22,
	},
}))
export type LeftSectionProps = {}

const LeftSection: FC<LeftSectionProps> = () => {
	const { classes } = useStyles()

	return (
		<Container w={"100%"}>
			<Text className={classes.klassenLager}>
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
				<Flex direction="column" py="xl" gap={"xs"} maw={300}>
					<Button href="/solar_dictionary" label="Dictionary" />
					<Button href="/solar_system" label="Solar Model" />
				</Flex>
			</Box>
		</Container>
	)
}
export default LeftSection

const Button: FC<{ href: string; label: string }> = ({ href, label }) => {
	const { classes } = useStyles()

	return (
		<Link href={href}>
			<MantineButton
				variant="gradient"
				gradient={{ from: "yellow", to: "red" }}
				size="xl"
				className={classes.button}
			>
				{label}
			</MantineButton>
		</Link>
	)
}
