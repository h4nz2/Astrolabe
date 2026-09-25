/**
 * "Back to the start" (#29, R / Home): the view the page was opened with, the
 * prepared lesson link, restored as a whole: body, point of view (#31),
 * camera, selection, date, speed, pause, layers and scale. A teacher who has
 * wandered off mid-lesson is one key away from the known state the lesson
 * began in. Without a link that is the app's own opening state: the overview,
 * now, at 1x.
 *
 * Everything goes through the store actions: the camera through the
 * navigation model, time through the clock actions (#9), the scale through
 * its animated switch. With `instant` (reduced motion) nothing animates.
 * The presentation settings are left alone: they belong to the room, not to
 * the lesson.
 */
import { isFrameAnchored } from "@/store/navigation"
import { useScaleStore } from "@/store/scale"
import { useSimStore } from "@/store/sim"
import type { SimSearch } from "@/store/simSearch"
import {
	DEFAULT_TIME_WARP,
	frameFromSearch,
	layersFromSearch,
	scaleFromSearch,
	viewFromSearch,
} from "@/store/urlSync"

import { switchScale } from "../ui/ScalePanel"

export function restoreStart(search: SimSearch, instant: boolean): void {
	const store = useSimStore.getState()
	const durationMs = instant ? 0 : undefined
	store.stopSequence()

	// time: speed and pause first, so a glide lands in the link's state
	store.setTimeWarp(search.warp ?? DEFAULT_TIME_WARP)
	store.setPaused(search.paused === true)
	if (search.t !== undefined && Number.isFinite(search.t)) {
		if (instant) store.setSimTime(search.t)
		else store.travelTo(search.t)
	} else {
		store.setNow()
	}

	// the view: a link without a camera gets the default framing
	const { view, shot, selectedId } = viewFromSearch(search)
	const frameId = frameFromSearch(search)
	const request = { shot: shot ?? { distance: 1 }, durationMs }
	if (frameId !== null) {
		store.anchorFrame(frameId, request)
	} else if (view.kind === "overview") {
		store.overview({ shot: shot ?? undefined, durationMs })
	} else {
		// leave a held body first, or the frame would follow the new focus
		if (isFrameAnchored(store)) store.releaseFrame({ durationMs })
		useSimStore.getState().goTo(view, request)
	}
	useSimStore.getState().select(selectedId)

	useSimStore.setState(layersFromSearch(search))
	const scale = scaleFromSearch(search)
	if (useScaleStore.getState().targetId !== scale) {
		if (instant) useScaleStore.getState().setPreset(scale)
		else switchScale(scale)
	}
}
