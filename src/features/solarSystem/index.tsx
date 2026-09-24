import { Suspense } from "react"
import { Group } from "@mantine/core"

import { LanguageMenu } from "@/i18n"
import Loader from "@/primitives/Loader"
import { useSimStore } from "@/store/sim"
import { useSimUrlSync } from "@/store/urlSync"

import { BirthdayPanelSlot } from "./birthday/Birthday"
import Scene from "./scene/Scene"
import BodyInfo from "./ui/BodyInfo"
import { freeCentreId } from "./ui/centre"
import CentreBadge from "./ui/CentreBadge"
import CentreMarker from "./ui/CentreMarker"
import FocusPicker from "./ui/FocusPicker"
import OverviewButton from "./ui/OverviewButton"
import SceneToggles from "./ui/SceneToggles"
import TimeControls from "./ui/TimeControls"

import classes from "./SolarSystem.module.css"

/**
 * Mirrors the store into the URL and back (src/store/urlSync.ts). An empty
 * component of its own, so the search-param subscription re-renders this node
 * alone and never the page or the Canvas. It must stay rendered BEFORE
 * <Scene />: layout effects run in tree order, so the URL seeds the store
 * before the Canvas mounts and a deep link (?focus=earth) is framed on its
 * body from the first frame instead of dollying there from the Sun.
 */
const UrlSync = () => {
	useSimUrlSync()
	return null
}

/** The centre badge's HUD panel, present only while the view is a free point in space (#15). */
const CentreBadgePanel = () => {
	const free = useSimStore((state) => freeCentreId(state) !== null)
	if (!free) return null
	return (
		<div className={`${classes.panel} ${classes.centre}`}>
			<CentreBadge />
		</div>
	)
}

/** The solar system page: the 3D scene filling the viewport with the HUD floating above it. */
const SolarSystem = () => {
	return (
		<div className={classes.page}>
			<UrlSync />
			<Suspense fallback={<Loader />}>
				<Scene />
			</Suspense>
			<CentreMarker />
			<div className={classes.hud}>
				<div className={`${classes.panel} ${classes.picker}`}>
					<OverviewButton />
					<FocusPicker />
				</div>
				<CentreBadgePanel />
				<div className={`${classes.panel} ${classes.toggles}`}>
					<Group gap="sm" justify="space-between" wrap="nowrap">
						<SceneToggles />
						<LanguageMenu />
					</Group>
				</div>
				<div className={`${classes.panel} ${classes.info}`}>
					<BodyInfo />
				</div>
				<div className={`${classes.panel} ${classes.time}`}>
					<TimeControls />
				</div>
			</div>
			<BirthdayPanelSlot />
		</div>
	)
}

export default SolarSystem
