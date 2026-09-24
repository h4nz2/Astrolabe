import { Button, Menu, Text } from "@mantine/core"
import {
	IconCheck,
	IconMoon,
	IconPinned,
	IconPlanet,
	IconSun,
} from "@tabler/icons-react"
import type { ReactNode } from "react"

import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"
import { OVERVIEW_BODY_ID, isFrameAnchored } from "@/store/navigation"
import { useSimStore } from "@/store/sim"

import {
	FRAME_PRESET_IDS,
	activeFramePreset,
	applyFramePreset,
	type FramePresetId,
} from "./presets"

import classes from "./Frame.module.css"

const PRESET_ICONS: Record<FramePresetId, ReactNode> = {
	sun: <IconSun size={18} aria-hidden />,
	planets: <IconPlanet size={18} aria-hidden />,
	moon: <IconMoon size={18} aria-hidden />,
}

/**
 * The point of view (#31): a button that always names the active reference
 * frame ("Sun-centred", "Seen from Earth"), opening the named presets and
 * "Hold <focus> still" for whatever is at the centre.
 */
const FrameMenu = () => {
	const { t } = useI18n()
	const name = useBodyName()
	const frameId = useSimStore((state) => state.frameId)
	const focusId = useSimStore((state) => state.focusId)
	const active = useSimStore(activeFramePreset)
	const anchorFrame = useSimStore((state) => state.anchorFrame)
	const anchored = isFrameAnchored({ frameId })
	const current = anchored
		? t("solarSystem.frame.current.held", {
				bodyId: frameId,
				body: name(frameId),
			})
		: t("solarSystem.frame.current.sun")
	const canHold = focusId !== OVERVIEW_BODY_ID && focusId !== frameId

	return (
		<Menu shadow="md" position="bottom-start" width={300}>
			<Menu.Target>
				<Button
					className={classes.menuButton}
					variant={anchored ? "filled" : "subtle"}
					color={anchored ? "orange" : "gray"}
					size="compact-sm"
					leftSection={
						anchored ? (
							<IconPinned size={16} aria-hidden />
						) : (
							<IconSun size={16} aria-hidden />
						)
					}
					aria-label={t("solarSystem.frame.menu", { current })}
					data-testid="frame-menu"
				>
					<span className={classes.menuText}>{current}</span>
				</Button>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Label>{t("solarSystem.frame.label")}</Menu.Label>
				{FRAME_PRESET_IDS.map((id) => (
					<Menu.Item
						key={id}
						leftSection={PRESET_ICONS[id]}
						rightSection={
							active === id ? <IconCheck size={14} aria-hidden /> : null
						}
						aria-current={active === id || undefined}
						onClick={() => applyFramePreset(id)}
						data-preset={id}
					>
						<Text size="sm">{t(`solarSystem.frame.presets.${id}.title`)}</Text>
						<Text size="xs" c="dimmed">
							{t(`solarSystem.frame.presets.${id}.hint`)}
						</Text>
					</Menu.Item>
				))}
				<Menu.Divider />
				<Menu.Item
					leftSection={<IconPinned size={18} aria-hidden />}
					disabled={!canHold}
					onClick={() => anchorFrame(focusId)}
					data-preset="hold"
				>
					<Text size="sm">
						{t("solarSystem.frame.presets.hold.title", {
							body: name(focusId),
						})}
					</Text>
					<Text size="xs" c="dimmed">
						{canHold || focusId === frameId
							? t("solarSystem.frame.presets.hold.hint", {
									body: name(focusId),
								})
							: t("solarSystem.frame.presets.hold.disabled")}
					</Text>
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	)
}

export default FrameMenu
