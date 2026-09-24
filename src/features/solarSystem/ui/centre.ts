/**
 * What the view is centred on (#15), for the HUD: the centre badge and the
 * centre marker. The user-facing strings of re-centring live here, in one
 * place, until they move into the i18n catalogue (#11).
 */
import { bodyById, sun, type Body } from "@/data"
import { viewMode, type NavigationSlice } from "@/store/navigation"

export const CENTRE_TEXT = {
	/** aria-label of the badge */
	region: "Centre of the view",
	freeView: "Free view",
	near: (name: string) => `near ${name}`,
	/** a free centre out between the planets (anchored to the Sun) */
	interplanetary: "in interplanetary space",
	centreOn: (name: string) => `Centre on ${name}`,
	backToOverview: "Back to overview",
} as const

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

/** One line for the free centre: "near Mars", "in interplanetary space". */
export const freeCentrePlace = (centre: FreeCentre): string =>
	centre.interplanetary
		? CENTRE_TEXT.interplanetary
		: CENTRE_TEXT.near(centre.anchor.name)
