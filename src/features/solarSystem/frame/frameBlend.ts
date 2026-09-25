/**
 * How the drawing moves from one reference frame into another (#31): the
 * anchored frames of src/sim/referenceFrame.ts are blended in over
 * `FRAME_BLEND_MS` of real time, so switching between the Sun-centred frame
 * and one held still on Earth slides every planet from where one frame draws
 * it to where the other does, instead of making it jump. The anchor itself
 * and the Sun never move in either frame.
 */
import type { FrameBlend } from "@/sim/referenceFrame"

/** Real time a change of frame takes, ms. */
export const FRAME_BLEND_MS = 1200

/** The linear progress of each blend slot (the weights are its eased form). */
export interface FrameBlendState {
	readonly progress: Float64Array
	/** Nothing has been stepped yet: the first step lands at once (a deep link opens in its frame). */
	started: boolean
}

export const createFrameBlendState = (slots: number): FrameBlendState => ({
	progress: new Float64Array(slots),
	started: false,
})

const smoothstep = (t: number): number => t * t * (3 - 2 * t)

/**
 * Moves the blend `dtMs` towards the frame anchored on top-level body
 * `target` (`root`: the Sun-centred frame) and writes the eased weights into
 * `blend`. A new anchor takes the slot that weighs least; the others fade out
 * as it fades in, so the weights never add up to more than 1.
 */
export function stepFrameBlend(
	blend: FrameBlend,
	state: FrameBlendState,
	target: number,
	root: number,
	dtMs: number,
): void {
	const { anchors, weights } = blend
	const progress = state.progress
	const slots = progress.length
	const step = state.started
		? Math.max(0, Number.isFinite(dtMs) ? dtMs : 0) / FRAME_BLEND_MS
		: Infinity
	state.started = true

	let slot = -1
	if (target !== root) {
		for (let k = 0; k < slots; k++) if (anchors[k] === target) slot = k
		if (slot < 0) {
			slot = 0
			for (let k = 1; k < slots; k++) {
				if (progress[k] < progress[slot]) slot = k
			}
			anchors[slot] = target
			progress[slot] = 0
		}
	}
	let others = 0
	for (let k = 0; k < slots; k++) {
		if (k === slot) continue
		progress[k] = Math.max(0, progress[k] - step)
		others += progress[k]
	}
	if (slot >= 0) {
		progress[slot] = Math.min(1 - others, progress[slot] + step)
	}
	for (let k = 0; k < slots; k++) weights[k] = smoothstep(progress[k])
}

/** How much of the drawing is in an anchored frame (0: Sun-centred, 1: fully anchored). */
export function anchoredWeight(blend: FrameBlend, root: number): number {
	let sum = 0
	for (let k = 0; k < blend.weights.length; k++) {
		if (blend.anchors[k] !== root) sum += blend.weights[k]
	}
	return Math.min(1, sum)
}

/** The weight of the frame anchored on top-level body `top` (0 when it is not blended in). */
export function anchorWeight(blend: FrameBlend, top: number): number {
	let sum = 0
	for (let k = 0; k < blend.weights.length; k++) {
		if (blend.anchors[k] === top) sum += blend.weights[k]
	}
	return sum
}
