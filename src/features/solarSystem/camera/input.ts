/**
 * Which gesture does what (docs/ARCHITECTURE.md, "Camera"). Mouse, touch and
 * trackpad get the same vocabulary: one finger or the left button orbits; the
 * wheel, a two-finger trackpad scroll, a touch pinch, a trackpad pinch
 * (`pinchAsDolly`) and the middle button dolly.
 */
import { CameraControlsImpl } from "@react-three/drei"
import { Spherical } from "three"

import { CAMERA_SMOOTH_TIME_S } from "./framing"

const { ACTION } = CameraControlsImpl
const scratch = new Spherical()

/**
 * Whether gestures may move the pivot itself (right button, two-finger drag,
 * three fingers). The director already turns a moved pivot into a `point`
 * view (free mode) and keeps the render origin on it; the switch stays off
 * until the re-centring issue (#15) ships its centre indicator.
 */
export const PAN_ENABLED = false

export interface InputOptions {
	pan: boolean
}

export function configureInput(
	controls: CameraControlsImpl,
	{ pan }: InputOptions,
): void {
	controls.mouseButtons.left = ACTION.ROTATE
	controls.mouseButtons.middle = ACTION.DOLLY
	controls.mouseButtons.right = pan ? ACTION.TRUCK : ACTION.ROTATE
	controls.mouseButtons.wheel = ACTION.DOLLY
	controls.touches.one = ACTION.TOUCH_ROTATE
	controls.touches.two = pan
		? ACTION.TOUCH_DOLLY_TRUCK
		: ACTION.TOUCH_DOLLY_ROTATE
	controls.touches.three = pan ? ACTION.TOUCH_TRUCK : ACTION.NONE
	// zooming toward the cursor would slide the pivot off the focus
	controls.dollyToCursor = false
	controls.infinityDolly = false
	controls.smoothTime = CAMERA_SMOOTH_TIME_S
}

/** Dolly per unit of ctrl+wheel delta (a trackpad pinch sends many small deltas). */
const PINCH_DOLLY_PER_DELTA = 0.1

/** The distance a trackpad pinch of `deltaY` dollies to (negative deltaY: fingers apart, closer). */
export const pinchDollyDistance = (radius: number, deltaY: number): number =>
	radius * Math.pow(0.95, -deltaY * PINCH_DOLLY_PER_DELTA)

/**
 * A trackpad pinch arrives as a ctrl+wheel, which camera-controls turns into
 * a camera zoom (a narrower field of view) instead of a dolly: every framing
 * rule assumes the field of view never changes. This listener runs first and
 * turns the pinch into the same dolly a touch pinch or the wheel does.
 * Returns the function that removes it.
 */
export function pinchAsDolly(
	controls: CameraControlsImpl,
	element: HTMLElement,
): () => void {
	const onWheel = (event: WheelEvent) => {
		if (!event.ctrlKey || !controls.enabled) return
		event.preventDefault()
		event.stopImmediatePropagation()
		const radius = controls.getSpherical(scratch, true).radius
		void controls.dollyTo(pinchDollyDistance(radius, event.deltaY), true)
		// user input, like any other gesture (hands a running transition over)
		controls.dispatchEvent({ type: "control" })
	}
	element.addEventListener("wheel", onWheel, { capture: true, passive: false })
	return () => element.removeEventListener("wheel", onWheel, { capture: true })
}
