/**
 * The pointer cursor over anything a click would act on (docs/ARCHITECTURE.md,
 * "Rendering"). Meshes and markers already report the body under the pointer
 * as `hoverId`; this mirrors it onto the canvas as `cursor: pointer`. Rendered
 * once inside the Canvas, renders nothing and never re-renders: it watches the
 * store through `subscribe`, which fires on every clock tick, so the canvas is
 * only written when the hover, the view or the selection changed.
 */
import { useLayoutEffect } from "react"
import { useThree } from "@react-three/fiber"

import { useSimStore, type SimState } from "@/store/sim"

type ClickState = Pick<SimState, "hoverId" | "view" | "selectedId">

/**
 * Whether a click on the hovered body would do anything (`setFocus`): every
 * body but the focus once it is also selected. That one fills the view up
 * close, where a hand over it would only suggest a click on every drag.
 */
export const isClickTarget = ({
	hoverId,
	view,
	selectedId,
}: ClickState): boolean =>
	hoverId !== null &&
	!(view.kind === "body" && view.id === hoverId && selectedId === hoverId)

/** Writes the cursor for `state` onto the canvas; `null` restores the default. */
export function applyHoverCursor(
	canvas: HTMLElement,
	state: ClickState | null,
): void {
	canvas.style.cursor = state !== null && isClickTarget(state) ? "pointer" : ""
}

function HoverCursor() {
	const canvas = useThree((state) => state.gl.domElement)

	useLayoutEffect(() => {
		applyHoverCursor(canvas, useSimStore.getState())
		const unsubscribe = useSimStore.subscribe((state, previous) => {
			if (
				state.hoverId !== previous.hoverId ||
				state.view !== previous.view ||
				state.selectedId !== previous.selectedId
			) {
				applyHoverCursor(canvas, state)
			}
		})
		return () => {
			unsubscribe()
			applyHoverCursor(canvas, null)
		}
	}, [canvas])

	return null
}

export default HoverCursor
