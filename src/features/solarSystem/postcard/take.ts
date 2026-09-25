import { hidesTimeInUrl, useBirthdayStore } from "@/store/birthday"
import { usePostcardStore, type PostcardExtra } from "@/store/postcard"
import { useScaleStore } from "@/store/scale"
import { useSimStore } from "@/store/sim"

import { captureScene } from "./capture"
import { postcardLink, postcardSubject } from "./postcard"

/**
 * Takes the picture now (call it from the click) and opens the postcard
 * dialog with it. A feature adds its own facts with `extra` (the birthday
 * ages, #26). Returns false when no scene is on screen to take.
 */
export function takePostcard(extra?: PostcardExtra): boolean {
	const shot = captureScene()
	if (shot === null) return false
	const sim = useSimStore.getState()
	const hideDate = hidesTimeInUrl(useBirthdayStore.getState())
	usePostcardStore.getState().show({
		shot,
		jd: sim.simTimeJD,
		subjectId: postcardSubject(sim),
		scalePreset: useScaleStore.getState().presetId,
		hideDate,
		link: postcardLink(window.location.href, sim.simTimeJD, hideDate),
		extra: extra ?? null,
	})
	return true
}
