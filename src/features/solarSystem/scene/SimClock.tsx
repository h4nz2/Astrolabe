/**
 * The single writer of simulation time and positions (docs/ARCHITECTURE.md,
 * "Runtime contract"). Runs at useFrame priority -1, before every other
 * subscriber, and keeps R3F's automatic rendering on.
 *
 * The store's `set` is cheap, so time advances through the store every frame;
 * React subscribers that follow the clock use `useThrottledSimTime()` instead
 * of a raw `simTimeJD` selector so they re-render at most 10 times a second.
 */
import { useFrame } from "@react-three/fiber"

import { useSimStore } from "@/store/sim"

import { updateSimFrame, useSimFrame } from "./simFrame"

/** Longest real-time step fed to the simulation (tab switches, hitches), seconds. */
export const MAX_FRAME_DELTA_S = 0.1

function SimClock() {
	const frame = useSimFrame()

	useFrame((_state, delta) => {
		const store = useSimStore.getState()
		store.advanceTime(Math.min(delta, MAX_FRAME_DELTA_S))

		// Phase 5 blends the origin from fly.fromId to fly.toId; until then the
		// origin snaps to the focus and the fly record simply expires.
		const { simTimeJD, focusId, fly } = useSimStore.getState()
		updateSimFrame(frame, simTimeJD, frame.index.get(focusId) ?? 0)

		if (fly !== null && performance.now() - fly.startedAt >= fly.durationMs) {
			store.endFly()
		}
	}, -1)

	return null
}

export default SimClock
