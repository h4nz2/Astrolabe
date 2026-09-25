/**
 * Places Earth's hand-over pulse (./pulse.ts) over Earth every frame, after
 * the camera director has moved the camera. Renders nothing.
 */
import { useFrame, useThree } from "@react-three/fiber"

import { applyRing, placeRing } from "../scene/highlight"
import { useSimFrame } from "../scene/simFrame"
import { useIntroStore } from "./intro"
import { PULSE_BODY_ID, pulseSlot } from "./pulse"

function IntroPulseTracker() {
	const frame = useSimFrame()
	const size = useThree((state) => state.size)

	useFrame(({ camera }) => {
		const element = pulseSlot.element
		if (element === null) return
		const index = frame.index.get(PULSE_BODY_ID)
		if (!useIntroStore.getState().pulse || index === undefined) {
			applyRing(element, null)
			return
		}
		camera.updateMatrixWorld()
		applyRing(element, placeRing(frame, index, camera, size.width, size.height))
	})

	return null
}

export default IntroPulseTracker
