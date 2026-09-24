/**
 * The single writer of the SimFrame's spin time (`frame.spinJD`; issue #13,
 * src/sim/spin.ts, docs/ARCHITECTURE.md, "Rotation"). Runs right after
 * SimClock (useFrame priority -0.9) so it follows the time written this frame,
 * and before anything draws. It reads the spin mode from src/store/spin.ts and
 * mirrors it onto the canvas as `data-spin-mode`, so tests and tooling can
 * tell which mode is on screen.
 */
import { useLayoutEffect, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"

import {
	advanceSpinClock,
	createSpinClock,
	type SpinClock as SpinClockState,
	type SpinMode,
} from "@/sim"
import { useSpinStore } from "@/store/spin"

import { useSimFrame, type SimFrame } from "./simFrame"

/** One tick: the spin time for the frame's simulation time at real time `realMs`. */
export function updateSpinTime(
	frame: SimFrame,
	clock: SpinClockState,
	realMs: number,
	mode: SpinMode,
): void {
	frame.spinJD = advanceSpinClock(clock, frame.jd, realMs, mode)
}

/** Mirrors the spin mode onto the canvas element. */
export function labelSpinMode(canvas: HTMLElement, mode: SpinMode): void {
	canvas.dataset.spinMode = mode
}

function SpinClock() {
	const frame = useSimFrame()
	const canvas = useThree((state) => state.gl.domElement)
	// real time 0: the first tick counts as one capped frame gap (MAX_SPIN_STEP_MS)
	const clock = useMemo(() => createSpinClock(frame.jd, 0), [frame])

	useLayoutEffect(() => {
		labelSpinMode(canvas, useSpinStore.getState().mode)
		return useSpinStore.subscribe((state) => labelSpinMode(canvas, state.mode))
	}, [canvas])

	useFrame(() => {
		updateSpinTime(
			frame,
			clock,
			performance.now(),
			useSpinStore.getState().mode,
		)
	}, -0.9)

	return null
}

export default SpinClock
