/**
 * Pushes the store's reference frame (`frameId`, #31) into the SimFrame once
 * per frame, before SimClock computes the display positions (priority -1.5),
 * blending over FRAME_BLEND_MS when it changes (./frameBlend.ts). A deep
 * link that opens anchored is drawn in its frame from the first frame.
 */
import { useMemo } from "react"
import { useFrame } from "@react-three/fiber"

import { rootIndexOf } from "@/sim"
import { useSimStore } from "@/store/sim"

import {
	FRAME_BLEND_SLOTS,
	useSimFrame,
	type SimFrame,
} from "../scene/simFrame"
import {
	createFrameBlendState,
	stepFrameBlend,
	type FrameBlendState,
} from "./frameBlend"

/** Runs before SimClock (-1), which applies the blend to the positions it computes. */
export const FRAME_SYNC_PRIORITY = -1.5

/** The top-level body the frame `frameId` holds still (the root for the Sun or an unknown id). */
export function frameTarget(frame: SimFrame, frameId: string): number {
	const i = frame.index.get(frameId)
	return i === undefined ? rootIndexOf(frame.bodies) : frame.topIndex[i]
}

/** One frame of the blend towards `frameId` (exported for tests). */
export function syncReferenceFrame(
	frame: SimFrame,
	state: FrameBlendState,
	frameId: string,
	dtMs: number,
): void {
	stepFrameBlend(
		frame.frameBlend,
		state,
		frameTarget(frame, frameId),
		rootIndexOf(frame.bodies),
		dtMs,
	)
}

function ReferenceFrameSync() {
	const frame = useSimFrame()
	const state = useMemo(() => createFrameBlendState(FRAME_BLEND_SLOTS), [])

	useFrame((_state, delta) => {
		syncReferenceFrame(
			frame,
			state,
			useSimStore.getState().frameId,
			delta * 1000,
		)
	}, FRAME_SYNC_PRIORITY)

	return null
}

export default ReferenceFrameSync
