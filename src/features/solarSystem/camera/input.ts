/**
 * Which gesture does what (docs/ARCHITECTURE.md, "Navigation"). Mouse, touch
 * and trackpad get the same vocabulary:
 * - orbit: one finger, the left button;
 * - dolly: the wheel, a two-finger trackpad scroll, a touch pinch, a trackpad
 *   pinch (`pinchAsDolly`), the middle button;
 * - pan (move the centre, #15): the right button (a two-finger click-drag on
 *   a trackpad), Shift + the left button (a one-button mouse or trackpad
 *   click), two fingers dragging (together with the pinch), three fingers.
 * A pan slides the centre across the plane of the planets' orbits (the
 * ecliptic), like dragging a map, so the pivot never wanders off above or
 * below the solar system.
 */
import { CameraControlsImpl } from "@react-three/drei"
import { Spherical } from "three"

import { CAMERA_SMOOTH_TIME_S } from "./framing"

const { ACTION } = CameraControlsImpl
const scratch = new Spherical()

/**
 * Whether gestures may move the pivot itself. The director turns a moved
 * pivot into a `point` view (free mode) or, when it lands on a body, glides
 * onto that body; the HUD shows the centre while it is not a body.
 */
export const PAN_ENABLED = true

export interface InputOptions {
	pan: boolean
}

export function configureInput(
	controls: CameraControlsImpl,
	{ pan }: InputOptions,
): void {
	controls.mouseButtons.left = ACTION.ROTATE
	controls.mouseButtons.middle = ACTION.DOLLY
	controls.mouseButtons.right = pan ? ACTION.SCREEN_PAN : ACTION.ROTATE
	controls.mouseButtons.wheel = ACTION.DOLLY
	controls.touches.one = ACTION.TOUCH_ROTATE
	controls.touches.two = pan
		? // supported at runtime, missing from camera-controls' multiTouchAction type
			(ACTION.TOUCH_DOLLY_SCREEN_PAN as typeof ACTION.TOUCH_DOLLY_TRUCK)
		: ACTION.TOUCH_DOLLY_ROTATE
	controls.touches.three = pan ? ACTION.TOUCH_SCREEN_PAN : ACTION.NONE
	// zooming toward the cursor would slide the pivot off the focus
	controls.dollyToCursor = false
	controls.infinityDolly = false
	controls.smoothTime = CAMERA_SMOOTH_TIME_S
}

/**
 * Shift + left button pans (for a one-button mouse and a trackpad click,
 * which have no right-button drag). camera-controls picks the action when the
 * button goes down, so this capture-phase listener sets the left button's
 * action just before it looks. Returns the function that removes it.
 */
export function shiftDragPans(
	controls: CameraControlsImpl,
	element: HTMLElement,
): () => void {
	const onPointerDown = (event: PointerEvent) => {
		if (event.pointerType !== "mouse" && event.pointerType !== "pen") return
		controls.mouseButtons.left = event.shiftKey
			? ACTION.SCREEN_PAN
			: ACTION.ROTATE
	}
	element.addEventListener("pointerdown", onPointerDown, { capture: true })
	return () =>
		element.removeEventListener("pointerdown", onPointerDown, {
			capture: true,
		})
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
