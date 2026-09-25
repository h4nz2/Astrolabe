/**
 * The Help menu (#30): the opening is shown once per device, and replayed
 * only deliberately from here; the movement hints can be called back too.
 */
import { ActionIcon, Menu, Tooltip } from "@mantine/core"
import { IconHandClick, IconHelp, IconPlayerPlay } from "@tabler/icons-react"

import { useI18n } from "@/i18n"

import { showHints, startIntro } from "./intro"

const IntroMenu = () => {
	const { t } = useI18n()
	const label = t("solarSystem.intro.menu")
	return (
		<Menu shadow="md" position="bottom-start">
			<Menu.Target>
				<Tooltip label={label}>
					<ActionIcon
						variant="subtle"
						color="gray"
						size="lg"
						aria-label={label}
						data-testid="intro-menu"
					>
						<IconHelp size={18} />
					</ActionIcon>
				</Tooltip>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Item
					leftSection={<IconPlayerPlay size={16} aria-hidden />}
					onClick={startIntro}
				>
					{t("solarSystem.intro.replay")}
				</Menu.Item>
				<Menu.Item
					leftSection={<IconHandClick size={16} aria-hidden />}
					onClick={showHints}
				>
					{t("solarSystem.intro.hints")}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	)
}

export default IntroMenu
