import { Button, Menu, Text } from "@mantine/core"
import { IconCheck, IconLanguage } from "@tabler/icons-react"

import { catalog, LOCALES, READING_LEVELS } from "./catalog"
import { useI18n } from "./context"

import classes from "./LanguageMenu.module.css"

/** A locale's own name ("Deutsch"), from its `locale.name` message. */
export const nativeLocaleName = (locale: string): string =>
	catalog.get(locale)?.get("locale.name") ?? locale

const check = (active: boolean) =>
	active ? <IconCheck size={14} aria-hidden /> : null

export type LanguageMenuProps = {
	/** `corner`: fixed to the top-right of the viewport (pages without a HUD). */
	placement?: "inline" | "corner"
}

/**
 * The language and reading-level switcher: a globe button showing the active
 * language code, with both choices in one menu. Languages are listed in their
 * own names and marked with their `lang`, so a screen reader pronounces them.
 */
function LanguageMenu({ placement = "inline" }: LanguageMenuProps) {
	const { t, locale, readingLevel, setLocale, setReadingLevel } = useI18n()
	const code = locale.toUpperCase()

	const menu = (
		<Menu shadow="md" position="bottom-end" width={280}>
			<Menu.Target>
				<Button
					variant="subtle"
					color="gray"
					size="compact-sm"
					leftSection={<IconLanguage size={16} aria-hidden />}
					aria-label={t("i18n.menu.button", { code })}
				>
					{code}
				</Button>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Label>{t("i18n.menu.language")}</Menu.Label>
				{LOCALES.map((id) => (
					<Menu.Item
						key={id}
						lang={id}
						role="menuitemradio"
						aria-checked={id === locale}
						rightSection={check(id === locale)}
						onClick={() => setLocale(id)}
					>
						{nativeLocaleName(id)}
					</Menu.Item>
				))}
				<Menu.Divider />
				<Menu.Label>{t("i18n.menu.readingLevel")}</Menu.Label>
				{READING_LEVELS.map((level) => (
					<Menu.Item
						key={level}
						role="menuitemradio"
						aria-checked={level === readingLevel}
						rightSection={check(level === readingLevel)}
						onClick={() => setReadingLevel(level)}
					>
						<Text size="sm">{t(`i18n.readingLevel.${level}.name`)}</Text>
						<Text size="xs" c="dimmed">
							{t(`i18n.readingLevel.${level}.description`)}
						</Text>
					</Menu.Item>
				))}
			</Menu.Dropdown>
		</Menu>
	)

	return placement === "corner" ? (
		<div className={classes.corner}>{menu}</div>
	) : (
		menu
	)
}

export default LanguageMenu
