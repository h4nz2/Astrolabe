/**
 * Which gesture does what (docs/ARCHITECTURE.md, "Camera"). Mouse, touch and
 * trackpad get the same vocabulary: one finger or the left button orbits, the
 * wheel, a pinch (a trackpad pinch arrives as a ctrl+wheel, which
 * camera-controls always treats as zoom) and the middle button dolly.
 */
import { CameraControlsImpl } from "@react-three/drei"

import { CAMERA_SMOOTH_TIME_S } from "./framing"

const { ACTION } = CameraControlsImpl

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
