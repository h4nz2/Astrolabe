/**
 * The side-by-side drawing (#24): every body at ONE scale (pixels per km),
 * the true relative sizes the whole feature is about. Pure and unit-tested;
 * the stage draws exactly what this returns.
 *
 * Bodies stand in a row, their centres on one line, each in a slot at least
 * as wide as its label. The scale is the largest at which the tallest body
 * fits the height and all the slots fit the width. When even the narrowest
 * slots cannot fit (all nine worlds on a phone), the height alone decides
 * and the row scrolls sideways.
 *
 * A body is drawn with its axis tilted in the picture by its axial tilt
 * (Uranus lies on its side) and its rings, when it has any, seen a little
 * from above (`RING_OPENING`); the slot makes room for the rings, the size
 * comparisons use the globe alone.
 */
import type { Body } from "@/data"

/** The rings' apparent minor/major axis ratio: seen from about 17° above the ring plane. */
export const RING_OPENING = 0.3

/** Globes drawn smaller than this (px across) are marked, because nobody finds them unaided. */
export const MIN_VISIBLE_PX = 2

export interface StageBody {
	id: string
	/** The globe's radius, km. */
	radiusKm: number
	/** Half the drawn width and height including rings and tilt, km (>= radiusKm). */
	halfWidthKm: number
	halfHeightKm: number
}

export interface StageOptions {
	/** The drawing area, px. */
	width: number
	height: number
	/** Space between two slots, px. */
	gap: number
	/** The narrowest slot, px: room for a label under a tiny body. */
	minSlot: number
}

export interface StageItem {
	id: string
	/** The globe's centre and radius, px (the radius at true relative scale, however small). */
	cx: number
	cy: number
	r: number
	/** The slot the body stands in: its left edge and width, px. */
	left: number
	width: number
	/** Drawn smaller than MIN_VISIBLE_PX across. */
	tiny: boolean
}

export interface StageLayout {
	/** The one scale every body is drawn at. */
	pxPerKm: number
	/** The row's width, px: the drawing width, or more when the row must scroll. */
	width: number
	height: number
	items: StageItem[]
}

/** The extent of a body's drawing: the globe, or the ring ellipse turned by the axial tilt. */
export function stageBody(
	body: Pick<Body, "id" | "radiusKm" | "rings" | "rotation">,
): StageBody {
	const r = body.radiusKm
	if (body.rings === null) {
		return { id: body.id, radiusKm: r, halfWidthKm: r, halfHeightKm: r }
	}
	const tilt = (body.rotation.axialTiltDeg * Math.PI) / 180
	const a = body.rings.outerRadiusKm
	const b = a * RING_OPENING
	return {
		id: body.id,
		radiusKm: r,
		halfWidthKm: Math.max(
			r,
			Math.hypot(a * Math.cos(tilt), b * Math.sin(tilt)),
		),
		halfHeightKm: Math.max(
			r,
			Math.hypot(a * Math.sin(tilt), b * Math.cos(tilt)),
		),
	}
}

const slotWidth = (body: StageBody, pxPerKm: number, minSlot: number) =>
	Math.max(2 * body.halfWidthKm * pxPerKm, minSlot)

const rowWidth = (
	row: readonly StageBody[],
	pxPerKm: number,
	options: StageOptions,
): number =>
	row.reduce(
		(sum, body) => sum + slotWidth(body, pxPerKm, options.minSlot),
		0,
	) +
	options.gap * Math.max(0, row.length - 1)

/** The largest scale at which `row` fits `options` (see the module comment). */
export function fitScale(
	row: readonly StageBody[],
	options: StageOptions,
): number {
	const tallest = Math.max(...row.map((body) => 2 * body.halfHeightKm))
	if (row.length === 0 || !(tallest > 0) || !(options.height > 0)) return 0
	const byHeight = options.height / tallest
	if (rowWidth(row, byHeight, options) <= options.width) return byHeight
	// even the narrowest slots overflow: let the height decide and scroll
	if (rowWidth(row, 0, options) >= options.width) return byHeight
	// the row's width grows monotonically with the scale: bisect
	let low = 0
	let high = byHeight
	for (let i = 0; i < 60; i++) {
		const mid = (low + high) / 2
		if (rowWidth(row, mid, options) <= options.width) low = mid
		else high = mid
	}
	return low
}

/** Places `row` (already in drawing order) at one common scale, centred in the drawing area. */
export function layoutStage(
	row: readonly StageBody[],
	options: StageOptions,
): StageLayout {
	const pxPerKm = fitScale(row, options)
	const total = rowWidth(row, pxPerKm, options)
	let x = Math.max(0, (options.width - total) / 2)
	const cy = options.height / 2
	const items = row.map((body): StageItem => {
		const width = slotWidth(body, pxPerKm, options.minSlot)
		const r = body.radiusKm * pxPerKm
		const item = {
			id: body.id,
			cx: x + width / 2,
			cy,
			r,
			left: x,
			width,
			tiny: 2 * r < MIN_VISIBLE_PX,
		}
		x += width + options.gap
		return item
	})
	return {
		pxPerKm,
		width: Math.max(options.width, total),
		height: options.height,
		items,
	}
}
