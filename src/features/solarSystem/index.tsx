import { Suspense } from "react"

import { LanguageMenu } from "@/i18n"
import Loader from "@/primitives/Loader"
import { isFrameAnchored } from "@/store/navigation"
import { useSimStore } from "@/store/sim"
import { useSimUrlSync } from "@/store/urlSync"

import { BirthdayPanelSlot } from "./birthday/Birthday"
import FrameBadge from "./frame/FrameBadge"
import FrameMenu from "./frame/FrameMenu"
import { LightSlot } from "./light/LightPanel"
import { InlineLayers, TeacherBar } from "./present/TeacherBar"
import PresentationLayer from "./present/PresentationLayer"
import Scene from "./scene/Scene"
import BodyHighlight from "./ui/BodyHighlight"
import BodyInfo from "./ui/BodyInfo"
import { freeCentreId } from "./ui/centre"
import CentreBadge from "./ui/CentreBadge"
import CentreMarker from "./ui/CentreMarker"
import FocusPicker from "./ui/FocusPicker"
import OverviewButton from "./ui/OverviewButton"
import ScalePanel from "./ui/ScalePanel"
import SceneToggles from "./ui/SceneToggles"
import SpinControl from "./ui/SpinControl"
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

/** The anchored frame's badge (#31), present only while a body is held still. */
const FrameBadgePanel = () => {
	const anchored = useSimStore((state) => isFrameAnchored(state))
	if (!anchored) return null
	return (
		<div className={classes.panel}>
			<FrameBadge />
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
			<BodyHighlight />
			<CentreMarker />
			<div className={classes.hud}>
				<div className={classes.pickerStack}>
					<div className={`${classes.panel} ${classes.picker}`}>
						<OverviewButton />
						<FocusPicker />
						<FrameMenu />
					</div>
					<FrameBadgePanel />
					<LightSlot
						phone={false}
						className={`${classes.panel} ${classes.light}`}
					/>
				</div>
				<CentreBadgePanel />
				<LightSlot phone className={`${classes.panel} ${classes.light}`} />
				<div className={classes.toggles}>
					<div className={classes.panel}>
						<TeacherBar layers={<SceneToggles />}>
							<LanguageMenu />
						</TeacherBar>
						<InlineLayers>
							<SceneToggles />
						</InlineLayers>
					</div>
					<div className={classes.panel}>
						<ScalePanel />
					</div>
				</div>
				<div className={`${classes.panel} ${classes.info}`}>
					<BodyInfo />
				</div>
				<div className={`${classes.panel} ${classes.time}`}>
					<TimeControls />
					<SpinControl />
				</div>
			</div>
			<BirthdayPanelSlot />
			<PresentationLayer />
		</div>
	)
}

export default SolarSystem
