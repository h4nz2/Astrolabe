import { Suspense, lazy, useEffect, useLayoutEffect } from "react"
import { ActionIcon, Button, Center, Loader } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { useSearch } from "@tanstack/react-router"
import { IconMoonStars } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { Hint } from "@/primitives/hint"
import { useBirthdayStore } from "@/store/birthday"
import { useHuntStore } from "@/store/hunt"
import { useSkyTonightStore } from "@/store/skyTonight"

import classes from "./SkyTonight.module.css"

// the panel brings astronomy-engine and the city list: loaded when first opened
const SkyTonightPanel = lazy(() => import("./SkyTonightPanel"))

/** Opens the sky panel; the birthday (#26) and hunt (#34) panels sit in the same place, so they close. */
const openSky = (): void => {
	useBirthdayStore.getState().setOpen(false)
	if (useHuntStore.getState().open) useHuntStore.getState().setOpen(false)
	useSkyTonightStore.getState().setOpen(true)
}

/** Closes the sky panel when another panel opens in its place. */
const closeSkyWhenOpened = (
	state: { open: boolean },
	previous: { open: boolean },
): void => {
	if (state.open && !previous.open) useSkyTonightStore.getState().setOpen(false)
}

/** The HUD button that opens "What is in the sky tonight". */
export const SkyTonightButton = () => {
	const { t } = useI18n()
	const open = useSkyTonightStore((state) => state.open)
	return (
		<Hint text={t("solarSystem.sky.openHint")}>
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
		</Hint>
	)
}

/** The HUD's phone breakpoint (SolarSystem.module.css). */
const PHONE_QUERY = "(max-width: 599px)"

const useIsPhone = () =>
	useMediaQuery(PHONE_QUERY, false, { getInitialValueInEffect: false })

/**
 * The button's place in the HUD from 600 px up: a small panel under the focus
 * picker (and the light launcher, #27), not in the time controls, which were
 * already as wide as a 1280 px screen allows beside the body card.
 */
export const SkyTonightLauncher = ({ className }: { className: string }) => {
	const phone = useIsPhone()
	if (phone) return null
	return (
		<div className={`${className} ${classes.launcher}`}>
			<SkyTonightButton />
		</div>
	)
}

/**
 * On phones the launcher is an icon in the focus picker's row: a row of its
 * own would push the panels at the top of a phone over the planets.
 */
export const SkyTonightPickerIcon = () => {
	const { t } = useI18n()
	const phone = useIsPhone()
	const open = useSkyTonightStore((state) => state.open)
	if (!phone) return null
	return (
		<Hint text={t("solarSystem.sky.openHint")}>
			<ActionIcon
				variant={open ? "filled" : "light"}
				color="orange"
				size="lg"
				aria-label={t("solarSystem.sky.open")}
				aria-expanded={open}
				aria-controls={open ? "sky-tonight-panel" : undefined}
				onClick={() =>
					open ? useSkyTonightStore.getState().setOpen(false) : openSky()
				}
			>
				<IconMoonStars size={18} />
			</ActionIcon>
		</Hint>
	)
}

/**
 * The sky panel's place on the page: nothing until opened. A link with
 * `?sky=true` (the hero page's button) opens it on arrival. Opening the
 * birthday or the hunt panel closes it. Leaving the page closes it; the chosen place stays
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
	useEffect(() => {
		const birthday = useBirthdayStore.subscribe(closeSkyWhenOpened)
		const hunt = useHuntStore.subscribe(closeSkyWhenOpened)
		return () => {
			birthday()
			hunt()
		}
	}, [])
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
