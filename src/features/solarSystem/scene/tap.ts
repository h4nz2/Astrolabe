/**
 * "A tap selects, a drag does not" (docs/ARCHITECTURE.md, "Navigation"): the
 * one rule every clickable thing in the scene applies. A finger wobbles more
 * than a mouse between press and release, so the allowance depends on the
 * pointer type, and it is measured on the whole path of the press: a drag
 * that wanders off and comes back to where it started is still a drag.
 */

/** Longest travel between press and release that is still a tap, px. */
export const TAP_MAX_TRAVEL_PX = { mouse: 4, pen: 8, touch: 12 } as const

type PointerKind = keyof typeof TAP_MAX_TRAVEL_PX

const isPointerKind = (value: unknown): value is PointerKind =>
	value === "mouse" || value === "pen" || value === "touch"

/** The current (or last) press: where it started and how far it has wandered. */
const press = {
	id: -1,
	kind: "mouse" as PointerKind,
	x: 0,
	y: 0,
	travel: 0,
}

if (typeof window !== "undefined") {
	const options = { capture: true, passive: true }
	window.addEventListener(
		"pointerdown",
		(event) => {
			press.id = event.pointerId
			if (isPointerKind(event.pointerType)) press.kind = event.pointerType
			press.x = event.clientX
			press.y = event.clientY
			press.travel = 0
		},
		options,
	)
	window.addEventListener(
		"pointermove",
		(event) => {
			if (event.pointerId !== press.id) return
			press.travel = Math.max(
				press.travel,
				Math.hypot(event.clientX - press.x, event.clientY - press.y),
			)
		},
		options,
	)
}

/** The pointer type behind a DOM event (a PointerEvent's own, else the last press's). */
export const pointerKindOf = (event: Event): PointerKind => {
	const type = (event as Partial<PointerEvent>).pointerType
	return isPointerKind(type) ? type : press.kind
}

export const isTap = (travelPx: number, kind: PointerKind): boolean =>
	travelPx <= TAP_MAX_TRAVEL_PX[kind]

/**
 * For R3F click events: `delta` is the distance from the press to the
 * release, px; the press's furthest excursion counts too.
 */
export const isTapEvent = (event: {
	delta: number
	nativeEvent: Event
}): boolean =>
	isTap(Math.max(event.delta, press.travel), pointerKindOf(event.nativeEvent))
