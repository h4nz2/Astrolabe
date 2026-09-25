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
import { useI18n } from "@/i18n"
import classes from "./LeftSection.module.css"

export type LeftSectionProps = Record<string, never>

const LeftSection: FC<LeftSectionProps> = () => {
	const { t } = useI18n()
	return (
		<Container w="100%">
			<Text component="div" className={classes.klassenLager}>
				<ScaleInOut delay={1} skipOutro={false}>
					{t("hero.credits")}
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
					{t("app.name")}
				</Text>
				<Title className={classes.title}>{t("hero.tagline")}</Title>
				<Flex direction="column" py="xl" gap="xs" maw={300}>
					<Button to="/solar_dictionary" label={t("hero.dictionary")} />
					<Button to="/solar_system" label={t("hero.solarSystem")} />
					<TourButton label={t("hero.tour")} />
					<BirthdayButton label={t("hero.birthday")} />
					<Button to="/solar_walk" label={t("hero.solarWalk")} />
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

/** Straight into the first guided tour (#28), for a visitor with no question of their own yet. */
const TourButton: FC<{ label: string }> = ({ label }) => {
	return (
		<MantineButton
			renderRoot={(props) => (
				<Link
					{...props}
					to="/solar_system"
					search={{ tour: "grandTour" }}
					preload="viewport"
				/>
			)}
			variant="outline"
			color="orange"
			size="xl"
			px="md"
			className={classes.button}
		>
			{label}
		</MantineButton>
	)
}

/** Straight to "Your birthday in space" (#26): the solar model with the birthday panel open. */
const BirthdayButton: FC<{ label: string }> = ({ label }) => {
	return (
		<MantineButton
			renderRoot={(props) => (
				<Link
					{...props}
					to="/solar_system"
					search={{ birthday: true }}
					preload="viewport"
				/>
			)}
			variant="outline"
			color="orange"
			size="xl"
			px="md"
			className={classes.button}
		>
			{label}
		</MantineButton>
	)
}
