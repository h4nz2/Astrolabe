/**
 * Pushes the active scale (src/store/scale.ts) into the Canvas's SimFrame
 * (docs/ARCHITECTURE.md, "Scale"). Rendered once inside the Canvas, renders
 * nothing and never re-renders: it watches the store through `subscribe`, so
 * an animated preset change (#21, one `setScale` per frame) costs no React work.
 *
 * It also mirrors the active preset id onto the canvas element as
 * `data-scale-preset` ("custom" for any other mix), so tests and tooling can
 * tell which scale is on screen without reaching into the app.
 */
import { useLayoutEffect } from "react"
import { useThree } from "@react-three/fiber"

import { useScaleStore, type ScaleState } from "@/store/scale"

import { setSimFrameScale, useSimFrame, type SimFrame } from "./simFrame"

/** The attribute value for the active preset. */
export const scalePresetAttribute = (
	presetId: ScaleState["presetId"],
): string => presetId ?? "custom"

/** Applies the store's scale to the frame and labels the canvas with the preset id. */
export function applyScale(
	frame: SimFrame,
	canvas: HTMLElement,
	state: Pick<ScaleState, "scale" | "presetId">,
): void {
	setSimFrameScale(frame, state.scale)
	canvas.dataset.scalePreset = scalePresetAttribute(state.presetId)
}

function ScaleSync() {
	const frame = useSimFrame()
	const canvas = useThree((state) => state.gl.domElement)

	useLayoutEffect(() => {
		applyScale(frame, canvas, useScaleStore.getState())
		return useScaleStore.subscribe((state, previous) => {
			if (
				state.scale !== previous.scale ||
				state.presetId !== previous.presetId
			) {
				applyScale(frame, canvas, state)
			}
		})
	}, [frame, canvas])

	return null
}

export default ScaleSync
