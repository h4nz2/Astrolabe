/**
 * Drives an animated preset switch (#21, src/store/scale.ts): one
 * `stepTransition` per frame while a transition runs, nothing otherwise.
 *
 * It runs before SimClock (priority -1), so the SimFrame is updated with this
 * frame's scale (ScaleSync applies every store change synchronously), and the
 * camera director (-0.5) keeps the framed body's size on screen as the rest
 * of the solar system shrinks or grows around it.
 */
import { useFrame } from "@react-three/fiber"

import { useScaleStore } from "@/store/scale"

export const SCALE_TRANSITION_PRIORITY = -2

/** Advances the running scale transition to `nowMs`; a no-op when none runs. */
export function stepScaleTransition(nowMs: number): void {
	const state = useScaleStore.getState()
	if (state.transition !== null) state.stepTransition(nowMs)
}

function ScaleTransition() {
	useFrame(
		() => stepScaleTransition(performance.now()),
		SCALE_TRANSITION_PRIORITY,
	)
	return null
}

export default ScaleTransition
