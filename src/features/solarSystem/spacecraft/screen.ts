/**
 * Where a spacecraft is on screen, and whether it is shown there (issue #35).
 * The markers and the names apply the same rule, the one moons follow for
 * their names (#20): a craft near a planet that is still a dot on screen is
 * hidden until it sits `MOON_MIN_SEPARATION_PX` clear of that dot, so JWST
 * and Juno do not bury the Earth's and Jupiter's dots in the overview. The
 * selected or pointed-at craft is always shown.
 */
import { PerspectiveCamera, Vector3 } from "three"

import { degToRad, toUnits } from "@/sim"

import { MARKER_HIDE_DIAMETER_PX, MARKER_SIZE_PX } from "../scene/Markers"
import type { SimFrame } from "../scene/simFrame"
import { OBSTACLE_MAX_RADIUS_PX, isClearOfParent } from "../labels/layout"
import type { CraftFrame } from "./craftFrame"

/** The craft's marker: a diamond this many px across (the bodies' dots are 4). */
export const CRAFT_MARKER_SIZE_PX = 9

/** Pixels per scene unit at unit distance. */
export const pixelsPerUnit = (
	camera: PerspectiveCamera,
	heightPx: number,
): number => heightPx / (2 * Math.tan(degToRad(camera.fov / 2))) / camera.zoom

export interface ScreenPoint {
	/** px from the top-left of the canvas */
	x: number
	y: number
	/** distance from the camera, scene units */
	depth: number
}

const view = new Vector3()

/** Projects a display-km point; false when it is behind the camera. */
export function projectDisplayKm(
	frame: Pick<SimFrame, "originKm">,
	displayKm: ArrayLike<number>,
	camera: PerspectiveCamera,
	widthPx: number,
	heightPx: number,
	out: ScreenPoint,
): boolean {
	view
		.set(
			toUnits(displayKm[0] - frame.originKm[0]),
			toUnits(displayKm[1] - frame.originKm[1]),
			toUnits(displayKm[2] - frame.originKm[2]),
		)
		.applyMatrix4(camera.matrixWorldInverse)
	out.depth = view.length()
	if (-view.z <= camera.near) return false
	view.applyMatrix4(camera.projectionMatrix)
	out.x = ((view.x + 1) / 2) * widthPx
	out.y = ((1 - view.y) / 2) * heightPx
	return true
}

const craftPoint: ScreenPoint = { x: 0, y: 0, depth: 0 }
const anchorPoint: ScreenPoint = { x: 0, y: 0, depth: 0 }
const anchorKm = new Float64Array(3)

/**
 * Whether craft `k` (present at the frame's time) is shown on screen: in
 * front of the camera and, near a planet drawn as a dot, clear of that dot
 * (`wasShown` gives the rule its hysteresis). Writes its screen position to `out`.
 */
export function craftOnScreen(
	frame: SimFrame,
	craftFrame: CraftFrame,
	k: number,
	camera: PerspectiveCamera,
	widthPx: number,
	heightPx: number,
	always: boolean,
	wasShown: boolean,
	out: ScreenPoint = craftPoint,
): boolean {
	const state = craftFrame.states[k]
	if (
		!projectDisplayKm(frame, state.displayKm, camera, widthPx, heightPx, out)
	) {
		return false
	}
	const anchor = state.anchorIndex
	if (always || anchor < 0 || frame.bodies[anchor].parentId === null) {
		return true
	}
	const o = anchor * 3
	anchorKm[0] = frame.displayKm[o]
	anchorKm[1] = frame.displayKm[o + 1]
	anchorKm[2] = frame.displayKm[o + 2]
	if (
		!projectDisplayKm(frame, anchorKm, camera, widthPx, heightPx, anchorPoint)
	) {
		return true
	}
	const r = frame.renderRadius(anchor)
	const d = anchorPoint.depth
	const discPx =
		d > r
			? (pixelsPerUnit(camera, heightPx) * r) / Math.sqrt(d * d - r * r)
			: Infinity
	// a planet bigger than a dot sets its craft apart by itself
	if (discPx > OBSTACLE_MAX_RADIUS_PX) return true
	const radius =
		2 * discPx <= MARKER_HIDE_DIAMETER_PX
			? Math.max(discPx, MARKER_SIZE_PX / 2)
			: discPx
	return isClearOfParent(
		out.x - anchorPoint.x,
		out.y - anchorPoint.y,
		radius,
		wasShown,
	)
}
