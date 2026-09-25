/**
 * Where a hint goes (#39): beside the control it describes, never on top of it.
 * Pure, so the "never covers its control" promise is unit-tested.
 */

export interface Box {
	readonly top: number
	readonly left: number
	readonly width: number
	readonly height: number
}

export interface Size {
	readonly width: number
	readonly height: number
}

export interface HintPlacement {
	readonly top: number
	readonly left: number
	/** Which side of the control the hint sits on. */
	readonly side: "above" | "below"
}

/** Space between the control and its hint, in CSS pixels. */
export const HINT_GAP = 8
/** The hint keeps this far from the viewport's edges. */
export const HINT_MARGIN = 8

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), Math.max(min, max))

/**
 * Above the control when it fits (the pointer and a finger come from below,
 * and it leaves the control's own row readable), otherwise below; if neither
 * fits, the side with more room. Horizontally centred on the control and kept
 * inside the viewport.
 */
export function placeHint(
	anchor: Box,
	hint: Size,
	viewport: Size,
	gap = HINT_GAP,
	margin = HINT_MARGIN,
): HintPlacement {
	const roomAbove = anchor.top - gap - margin
	const roomBelow =
		viewport.height - (anchor.top + anchor.height) - gap - margin
	const side =
		hint.height <= roomAbove
			? "above"
			: hint.height <= roomBelow
				? "below"
				: roomAbove >= roomBelow
					? "above"
					: "below"
	const top =
		side === "above"
			? anchor.top - gap - hint.height
			: anchor.top + anchor.height + gap
	const left = clamp(
		anchor.left + anchor.width / 2 - hint.width / 2,
		margin,
		viewport.width - margin - hint.width,
	)
	return {
		side,
		left,
		top: clamp(top, margin, viewport.height - margin - hint.height),
	}
}

/** The smallest box around all of `boxes` that have an area (a control made of several elements). */
export function unionBox(boxes: readonly Box[]): Box | null {
	const real = boxes.filter((box) => box.width > 0 || box.height > 0)
	if (real.length === 0) return null
	const top = Math.min(...real.map((box) => box.top))
	const left = Math.min(...real.map((box) => box.left))
	const bottom = Math.max(...real.map((box) => box.top + box.height))
	const right = Math.max(...real.map((box) => box.left + box.width))
	return { top, left, width: right - left, height: bottom - top }
}

/** Whether two boxes overlap (touching edges do not count). */
export function overlaps(a: Box, b: Box): boolean {
	return (
		a.left < b.left + b.width &&
		b.left < a.left + a.width &&
		a.top < b.top + b.height &&
		b.top < a.top + a.height
	)
}
