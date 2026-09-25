import { Suspense, lazy, useEffect, useLayoutEffect } from "react"
import { Button, Center, Loader, Tooltip } from "@mantine/core"
import { useSearch } from "@tanstack/react-router"
import { IconMoonStars } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { useBirthdayStore } from "@/store/birthday"
import { useSkyTonightStore } from "@/store/skyTonight"

import classes from "./SkyTonight.module.css"

// the panel brings astronomy-engine and the city list: loaded when first opened
const SkyTonightPanel = lazy(() => import("./SkyTonightPanel"))

/** Opens the sky panel; the birthday panel (#26) sits in the same place, so it closes. */
const openSky = (): void => {
	useBirthdayStore.getState().setOpen(false)
	useSkyTonightStore.getState().setOpen(true)
}

/** The HUD button that opens "What is in the sky tonight" (in the time controls). */
export const SkyTonightButton = () => {
	const { t } = useI18n()
	const open = useSkyTonightStore((state) => state.open)
	return (
		<Tooltip label={t("solarSystem.sky.openHint")} openDelay={400}>
			<Button
				variant={open ? "filled" : "light"}
				color="orange"
				size="compact-sm"
				leftSection={<IconMoonStars size={16} />}
				aria-expanded={open}
				aria-controls={open ? "sky-tonight-panel" : undefined}
				onClick={() =>
					open ? useSkyTonightStore.getState().setOpen(false) : openSky()
				}
			>
				{t("solarSystem.sky.open")}
			</Button>
		</Tooltip>
	)
}

/**
 * The sky panel's place on the page: nothing until opened. A link with
 * `?sky=true` (the hero page's button) opens it on arrival. Opening the
 * birthday panel closes it. Leaving the page closes it; the chosen place stays
 * in memory until the tab is closed or "Change place" is pressed.
 */
export const SkyTonightSlot = () => {
	const open = useSkyTonightStore((state) => state.open)
	const requested = useSearch({
		from: "/solar_system",
		select: (search) => search.sky === true,
	})
	useLayoutEffect(() => {
		if (requested) openSky()
	}, [requested])
	useEffect(
		() =>
			useBirthdayStore.subscribe((state, previous) => {
				if (state.open && !previous.open)
					useSkyTonightStore.getState().setOpen(false)
			}),
		[],
	)
	useLayoutEffect(() => () => useSkyTonightStore.getState().setOpen(false), [])
	if (!open) return null
	return (
		<Suspense
			fallback={
				<div className={classes.panel}>
					<Center h="100%" p="xl">
						<Loader size="sm" color="orange" />
					</Center>
				</div>
			}
		>
			<SkyTonightPanel />
		</Suspense>
	)
}
