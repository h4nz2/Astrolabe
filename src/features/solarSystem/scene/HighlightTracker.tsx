/**
 * Places the hover and selection rings (`./highlight.ts`) over their bodies
 * every frame, after the camera director has moved the camera. Renders nothing.
 */
import { useFrame, useThree } from "@react-three/fiber"

import { useSimStore } from "@/store/sim"

import {
	SELECTION_RING_MAX_DISC_PX,
	applyRing,
	highlightSlots,
	placeRing,
} from "./highlight"
import { isClickTarget } from "./HoverCursor"
import { useSimFrame } from "./simFrame"

function HighlightTracker() {
	const frame = useSimFrame()
	const size = useThree((state) => state.size)

	useFrame(({ camera }) => {
		const { hover, selection } = highlightSlots
		if (hover === null && selection === null) return
		// the director moved the camera this frame; its matrices follow at render
		camera.updateMatrixWorld()
		const state = useSimStore.getState()
		const place = (id: string | null) => {
			const index = id === null ? undefined : frame.index.get(id)
			return index === undefined
				? null
				: placeRing(frame, index, camera, size.width, size.height)
		}
		const hoverId = isClickTarget(state) ? state.hoverId : null
		if (hover !== null) applyRing(hover, place(hoverId))
		if (selection !== null) {
			const selectedId = state.selectedId !== hoverId ? state.selectedId : null
			const ring = place(selectedId)
			applyRing(
				selection,
				ring !== null && ring.discPx < SELECTION_RING_MAX_DISC_PX ? ring : null,
			)
		}
	})

	return null
}

export default HighlightTracker
