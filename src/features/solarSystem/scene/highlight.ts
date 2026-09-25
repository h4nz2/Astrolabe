/**
 * Rings around the hovered and the selected body (#16): the overlay elements
 * live in the HUD (`ui/BodyHighlight.tsx`), and `HighlightTracker` places them
 * over their bodies every frame, straight on the DOM, so a moving body never
 * re-renders React. The slots are module state because the page has exactly
 * one scene.
 */
import { PerspectiveCamera, Vector3, type Camera } from "three"

import { pixelsPerUnitAtDistanceOne } from "./picking"
import type { SimFrame } from "./simFrame"

export interface HighlightSlots {
	/** Ring (and name) around the body a click would act on. */
	hover: HTMLElement | null
	/** Ring around the selected body while it is too small to see at a glance. */
	selection: HTMLElement | null
}

export const highlightSlots: HighlightSlots = { hover: null, selection: null }

/** Gap between a body's drawn edge and its ring, px. */
export const RING_GAP_PX = 5
/** Smallest ring radius, px: a sub-pixel planet still gets a ring you can see. */
export const RING_MIN_RADIUS_PX = 14
/**
 * The selection ring is drawn while the selected body's disc is smaller than
 * this (radius, px); a bigger disc is its own highlight.
 */
export const SELECTION_RING_MAX_DISC_PX = 40

export interface RingPlacement {
	/** Centre on the canvas, CSS px from the top left. */
	x: number
	y: number
	/** The body's drawn radius on screen, px. */
	discPx: number
	/** The ring's radius, px. */
	ringPx: number
}

const scratch = new Vector3()

/**
 * Where body `index` is on a `width` x `height` canvas, or null when it is
 * behind the camera or off screen.
 */
export function placeRing(
	frame: Pick<SimFrame, "renderPosition" | "renderRadius">,
	index: number,
	camera: Camera,
	width: number,
	height: number,
): RingPlacement | null {
	if (!(camera instanceof PerspectiveCamera)) return null
	frame.renderPosition(index, scratch)
	const distance = scratch.distanceTo(camera.position)
	scratch.project(camera)
	if (!(scratch.z < 1) || !Number.isFinite(scratch.x)) return null
	const x = ((scratch.x + 1) / 2) * width
	const y = ((1 - scratch.y) / 2) * height
	const discPx =
		distance > 0
			? (frame.renderRadius(index) / distance) *
				pixelsPerUnitAtDistanceOne(camera, height)
			: Infinity
	const ringPx = Math.max(discPx + RING_GAP_PX, RING_MIN_RADIUS_PX)
	if (
		x + ringPx < 0 ||
		x - ringPx > width ||
		y + ringPx < 0 ||
		y - ringPx > height
	) {
		return null
	}
	return { x, y, discPx, ringPx }
}

/** Shows `element` as a ring at `placement`, or hides it for null. */
export function applyRing(
	element: HTMLElement,
	placement: RingPlacement | null,
): void {
	if (placement === null) {
		if (element.style.visibility !== "hidden") {
			element.style.visibility = "hidden"
		}
		return
	}
	const { x, y, ringPx } = placement
	const size = `${Math.round(ringPx * 2)}px`
	const transform = `translate(${(x - ringPx).toFixed(1)}px, ${(y - ringPx).toFixed(1)}px)`
	if (element.style.width !== size) {
		element.style.width = size
		element.style.height = size
	}
	if (element.style.transform !== transform) element.style.transform = transform
	if (element.style.visibility !== "visible") {
		element.style.visibility = "visible"
	}
}
