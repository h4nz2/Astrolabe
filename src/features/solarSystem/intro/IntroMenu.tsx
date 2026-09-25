/**
 * The Help menu (#30): the opening is shown once per device, and replayed
 * only deliberately from here; the movement hints can be called back too.
 * Since #43 it is the chevron beside the Help button (a split button): the
 * button opens the help page in one click, the chevron offers the rest.
 */
import { ActionIcon, Menu, Tooltip } from "@mantine/core"
import { Link } from "@tanstack/react-router"
import {
	IconBook,
	IconChevronDown,
	IconHandClick,
	IconPlayerPlay,
} from "@tabler/icons-react"

import { useI18n } from "@/i18n"

import { showHints, startIntro } from "./intro"

const IntroMenu = () => {
	const { t } = useI18n()
	const label = t("help.more")
	return (
		<Menu shadow="md" position="bottom-start">
			<Menu.Target>
				<Tooltip label={label}>
					<ActionIcon
						variant="subtle"
						color="gray"
						size="md"
						aria-label={label}
						data-testid="intro-menu"
					>
						<IconChevronDown size={16} />
					</ActionIcon>
				</Tooltip>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Item
					component={Link}
					to="/help"
					leftSection={<IconBook size={16} aria-hidden />}
				>
					{t("help.buttonHint")}
				</Menu.Item>
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
