/**
 * The spacecraft menu (issue #35), beside the focus picker: the layer switch,
 * "show every path", and every craft with what it is and whether it is working
 * at the simulation date. Picking one selects it and flies the view there.
 */
import { useState } from "react"
import {
	ActionIcon,
	Group,
	Popover,
	ScrollArea,
	Stack,
	Switch,
	Text,
	Tooltip,
	UnstyledButton,
} from "@mantine/core"
import { IconSatellite } from "@tabler/icons-react"

import { spacecraft } from "@/data/spacecraft"
import { useI18n } from "@/i18n"
import { getSpacecraftText } from "@/i18n/spacecraft"
import { craftPhase } from "@/sim/spacecraft"
import { useScaleStore } from "@/store/scale"
import type { Spacecraft } from "@/data/spacecraft"
import { useSpacecraftStore } from "@/store/spacecraft"

import useThrottledSimTime from "../scene/useThrottledSimTime"
import { formatDayUTC } from "../ui/timeTravel"
import { showCraft } from "./facts"

import classes from "./Spacecraft.module.css"

const SpacecraftMenu = () => {
	const i18n = useI18n()
	const { t } = i18n
	const [opened, setOpened] = useState(false)
	const jd = useThrottledSimTime()
	const scale = useScaleStore((state) => state.scale)
	const show = useSpacecraftStore((state) => state.showSpacecraft)
	const allPaths = useSpacecraftStore((state) => state.showAllPaths)
	const selected = useSpacecraftStore((state) => state.selectedCraftId)
	const { setShowSpacecraft, setShowAllPaths } = useSpacecraftStore.getState()
	const label = t("solarSystem.spacecraft.menu")
	const day = (iso: string) => formatDayUTC(new Date(iso), i18n.formatLocale)
	const phaseText = (
		craft: Spacecraft,
		phase: ReturnType<typeof craftPhase>,
	) =>
		phase === "planned"
			? t("solarSystem.spacecraft.phase.planned", { date: day(craft.launch) })
			: phase === "active"
				? t("solarSystem.spacecraft.phase.active")
				: t(`solarSystem.spacecraft.phase.${phase}`, {
						date: day(craft.end?.date ?? craft.dataTo),
					})

	return (
		<Popover
			opened={opened}
			onChange={setOpened}
			position="bottom-start"
			width={340}
			shadow="md"
			radius="md"
			trapFocus
			returnFocus
		>
			<Popover.Target>
				<Tooltip label={t("solarSystem.spacecraft.menuHint")} disabled={opened}>
					<ActionIcon
						variant={show ? "light" : "subtle"}
						color={show ? "cyan" : "gray"}
						size="lg"
						aria-label={label}
						aria-haspopup="dialog"
						aria-expanded={opened}
						onClick={() => setOpened((open) => !open)}
					>
						<IconSatellite size={18} />
					</ActionIcon>
				</Tooltip>
			</Popover.Target>
			<Popover.Dropdown
				className={classes.dropdown}
				aria-label={t("solarSystem.spacecraft.menuTitle")}
			>
				<Stack gap="xs">
					<Text fw={700} size="sm">
						{t("solarSystem.spacecraft.menuTitle")}
					</Text>
					<Text size="xs" c="dimmed" lh={1.35}>
						{t("solarSystem.spacecraft.menuIntro")}
					</Text>
					<Group gap="md">
						<Switch
							size="xs"
							color="cyan"
							label={t("solarSystem.spacecraft.layer")}
							checked={show}
							onChange={(event) =>
								setShowSpacecraft(event.currentTarget.checked)
							}
						/>
						<Switch
							size="xs"
							color="cyan"
							label={t("solarSystem.spacecraft.allPaths")}
							checked={allPaths}
							disabled={!show}
							onChange={(event) => setShowAllPaths(event.currentTarget.checked)}
						/>
					</Group>
					<ScrollArea.Autosize
						mah="min(22rem, 50dvh)"
						type="auto"
						offsetScrollbars
					>
						<Stack gap={2}>
							{spacecraft.map((craft) => {
								const text = getSpacecraftText(craft.id, i18n)
								const phase = craftPhase(craft, jd)
								const status = phaseText(craft, phase)
								return (
									<UnstyledButton
										key={craft.id}
										className={classes.craft}
										data-craft={craft.id}
										data-phase={phase}
										data-selected={craft.id === selected || undefined}
										onClick={() => {
											setShowSpacecraft(true)
											showCraft(craft.id, scale)
											setOpened(false)
										}}
									>
										<span className={classes.craftName}>{text.name}</span>
										<span className={classes.craftTagline}>{text.tagline}</span>
										<span className={classes.craftStatus}>{status}</span>
									</UnstyledButton>
								)
							})}
						</Stack>
					</ScrollArea.Autosize>
				</Stack>
			</Popover.Dropdown>
		</Popover>
	)
}

export default SpacecraftMenu
