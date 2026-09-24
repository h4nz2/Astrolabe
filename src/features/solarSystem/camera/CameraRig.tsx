/**
 * drei CameraControls with the target pinned to the render origin (0, 0, 0),
 * where SimClock keeps the focus body. Only actions that leave the target
 * alone are enabled (rotate and dolly; no trucking, which would slide the
 * focus off the origin for good), and every focus change re-pins the target
 * before framing. The first mount frames the focus from 45 degrees above the
 * ecliptic (the Sun at 40 radii); a later focus change keeps the viewing
 * direction and dollies to the framing distance. The fly-to blend of the
 * origin is Phase 5.
 */
import { useEffect, useRef } from "react"
import { CameraControls, CameraControlsImpl } from "@react-three/drei"

import { bodyById, sun } from "@/data"
import { degToRad, toUnits } from "@/sim"
import { useSimStore } from "@/store/sim"

import {
	CAMERA_MAX_DISTANCE,
	CAMERA_SMOOTH_TIME_S,
	INITIAL_ELEVATION_DEG,
	framingDistance,
	minDollyDistance,
} from "./framing"

export {
	CAMERA_MAX_DISTANCE,
	CAMERA_SMOOTH_TIME_S,
	FRAMING_RADII,
	INITIAL_ELEVATION_DEG,
	INITIAL_SUN_RADII,
	MIN_DISTANCE_RADII,
} from "./framing"

const { ACTION } = CameraControlsImpl

/**
 * Pointer actions that keep the target where it is. camera-controls defaults
 * the right button and the two/three-finger gestures to trucking.
 */
export function pinTarget(controls: CameraControlsImpl): void {
	controls.mouseButtons.right = ACTION.ROTATE
	controls.touches.two = ACTION.TOUCH_DOLLY_ROTATE
	controls.touches.three = ACTION.NONE
}

function CameraRig() {
	const controlsRef = useRef<CameraControlsImpl>(null)
	const focusId = useSimStore((state) => state.focusId)
	const focus = bodyById.get(focusId) ?? sun
	const focusRadius = toUnits(focus.radiusKm)
	// the focus this rig last framed; null before the first framing
	const framedFocusRef = useRef<string | null>(null)

	useEffect(() => {
		const controls = controlsRef.current
		if (controls === null) return
		pinTarget(controls)
		const previous = framedFocusRef.current
		if (previous === focusId) return
		framedFocusRef.current = focusId

		// a stray offset must never survive a focus change
		void controls.setTarget(0, 0, 0, false)
		const distance = framingDistance(focus.kind, focusRadius, previous === null)
		if (previous === null) {
			const elevation = degToRad(INITIAL_ELEVATION_DEG)
			void controls.setLookAt(
				0,
				distance * Math.sin(elevation),
				distance * Math.cos(elevation),
				0,
				0,
				0,
				false,
			)
			return
		}
		void controls.dollyTo(distance, true)
	}, [focus.kind, focusId, focusRadius])

	return (
		<CameraControls
			ref={controlsRef}
			makeDefault
			minDistance={minDollyDistance(focusRadius)}
			maxDistance={CAMERA_MAX_DISTANCE}
			dollyToCursor={false}
			smoothTime={CAMERA_SMOOTH_TIME_S}
		/>
	)
}

export default CameraRig
