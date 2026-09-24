/**
 * The single writer of simulation time and positions (docs/ARCHITECTURE.md,
 * "Runtime contract"). Runs at useFrame priority -1, before every other
 * subscriber, and keeps R3F's automatic rendering on.
 *
 * Time is not accumulated here: `tick(performance.now())` samples the store's
 * clock (src/sim/clock.ts), a pure function of real time, so the simulation
 * shows the same instant whatever the frame rate. React subscribers that follow
 * the clock use `useThrottledSimTime()` instead of a raw `simTimeJD` selector
 * so they re-render at most 10 times a second.
 */
import { useFrame } from "@react-three/fiber"

import { useSimStore } from "@/store/sim"

import { updateSimFrame, useSimFrame } from "./simFrame"

function SimClock() {
	const frame = useSimFrame()

	useFrame(() => {
		const store = useSimStore.getState()
		store.tick(performance.now())

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
