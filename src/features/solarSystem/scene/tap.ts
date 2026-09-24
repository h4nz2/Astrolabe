/**
 * "A tap selects, a drag does not" (docs/ARCHITECTURE.md, "Navigation"): the
 * one rule every clickable thing in the scene applies. A finger wobbles more
 * than a mouse between press and release, so the allowance depends on the
 * pointer type.
 */

/** Longest travel between press and release that is still a tap, px. */
export const TAP_MAX_TRAVEL_PX = { mouse: 4, pen: 8, touch: 12 } as const

type PointerKind = keyof typeof TAP_MAX_TRAVEL_PX

const isPointerKind = (value: unknown): value is PointerKind =>
	value === "mouse" || value === "pen" || value === "touch"

// Browsers whose `click` is a plain MouseEvent (no pointerType) fall back to
// the type of the last press.
let lastPressType: PointerKind = "mouse"
if (typeof window !== "undefined") {
	window.addEventListener(
		"pointerdown",
		(event) => {
			if (isPointerKind(event.pointerType)) lastPressType = event.pointerType
		},
		{ capture: true, passive: true },
	)
}

/** The pointer type behind a DOM event (a PointerEvent's own, else the last press). */
export const pointerKindOf = (event: Event): PointerKind => {
	const type = (event as Partial<PointerEvent>).pointerType
	return isPointerKind(type) ? type : lastPressType
}

export const isTap = (travelPx: number, kind: PointerKind): boolean =>
	travelPx <= TAP_MAX_TRAVEL_PX[kind]

/** For R3F click events: `delta` is the pointer travel since the press, px. */
export const isTapEvent = (event: {
	delta: number
	nativeEvent: Event
}): boolean => isTap(event.delta, pointerKindOf(event.nativeEvent))
