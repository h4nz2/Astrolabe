/**
 * What the view is centred on (#15), for the HUD: the centre badge and the
 * centre marker. Its strings are `solarSystem.centre.*` in the locales.
 */
import { bodyById, sun, type Body } from "@/data"
import { viewMode, type NavigationSlice } from "@/store/navigation"

export interface FreeCentre {
	/** The body whose neighbourhood the free centre is in. */
	anchor: Body
	/** Out between the planets (the anchor is the Sun). */
	interplanetary: boolean
}

/**
 * The anchor of the free centre (a point in space the user panned to), or
 * null while the view is centred on a body, the overview, or a transition to
 * one of them. A string, so it is a stable store selector.
 */
export const freeCentreId = (
	state: Pick<NavigationSlice, "view" | "transition">,
): string | null =>
	state.view.kind === "point" && viewMode(state) === "free"
		? state.view.anchorId
		: null

/** The free centre for an anchor id from `freeCentreId`. */
export function freeCentre(anchorId: string | null): FreeCentre | null {
	const anchor = anchorId === null ? undefined : bodyById.get(anchorId)
	if (anchor === undefined) return null
	return { anchor, interplanetary: anchor.id === sun.id }
}
