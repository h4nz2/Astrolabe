import { Suspense, lazy, useLayoutEffect } from "react"
import { Button, Center, Loader, Tooltip } from "@mantine/core"
import { useSearch } from "@tanstack/react-router"
import { IconCake } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { useBirthdayStore } from "@/store/birthday"

import classes from "./BirthdayPanel.module.css"

// the panel brings the calendar (@mantine/dates): loaded when first opened
const BirthdayPanel = lazy(() => import("./BirthdayPanel"))

/** The HUD button that opens "Your birthday in space" (in the time controls). */
export const BirthdayButton = () => {
	const { t } = useI18n()
	const open = useBirthdayStore((state) => state.open)
	const setOpen = useBirthdayStore((state) => state.setOpen)
	return (
		<Tooltip label={t("solarSystem.birthday.openHint")} openDelay={400}>
			<Button
				variant={open ? "filled" : "light"}
				color="orange"
				size="compact-sm"
				leftSection={<IconCake size={16} />}
				aria-expanded={open}
				aria-controls={open ? "birthday-panel" : undefined}
				onClick={() => setOpen(!open)}
			>
				{t("solarSystem.birthday.open")}
			</Button>
		</Tooltip>
	)
}

/**
 * The birthday panel's place on the page: nothing until opened. A link with
 * `?birthday=true` (the hero page's button) opens it on arrival. Leaving the
 * page closes it; the birth date stays in memory until the tab is closed or
 * "Forget my birthday" is pressed.
 */
export const BirthdayPanelSlot = () => {
	const open = useBirthdayStore((state) => state.open)
	const requested = useSearch({
		from: "/solar_system",
		select: (search) => search.birthday === true,
	})
	useLayoutEffect(() => {
		if (requested) useBirthdayStore.getState().setOpen(true)
	}, [requested])
	useLayoutEffect(() => () => useBirthdayStore.getState().setOpen(false), [])
	if (!open) return null
	return (
		<Suspense
			fallback={
				<div className={classes.panel}>
					<Center h="100%">
						<Loader size="sm" color="orange" />
					</Center>
				</div>
			}
		>
			<BirthdayPanel />
		</Suspense>
	)
}
