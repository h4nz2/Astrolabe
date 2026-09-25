/**
 * Mounts the camera's single owner (docs/ARCHITECTURE.md, "Navigation"): one
 * camera-controls instance for the pointer, wheel and touch gestures, and the
 * CameraDirector that drives it and the render origin from the navigation
 * slice of the store. The controls are created here rather than through drei's
 * <CameraControls>, whose own useFrame would update them before the director
 * has placed the origin; the director calls `update` itself, once per frame at
 * CAMERA_FRAME_PRIORITY.
 */
import { useEffect, useMemo } from "react"
import { CameraControlsImpl } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import {
	Box3,
	MathUtils,
	Matrix4,
	PerspectiveCamera,
	Quaternion,
	Raycaster,
	Sphere,
	Spherical,
	Vector2,
	Vector3,
	Vector4,
} from "three"

import { useSimStore } from "@/store/sim"

import { useSimFrame } from "../scene/simFrame"
import { exposeDebugHandle } from "./debugHandle"
import { CAMERA_FRAME_PRIORITY, CameraDirector } from "./director"
import {
	PAN_ENABLED,
	configureInput,
	pinchAsDolly,
	shiftDragPans,
} from "./input"

// camera-controls needs the three.js classes it uses handed to it once
// (what drei's <CameraControls> does on mount)
CameraControlsImpl.install({
	THREE: {
		Box3,
		MathUtils: { clamp: MathUtils.clamp },
		Matrix4,
		Quaternion,
		Raycaster,
		Sphere,
		Spherical,
		Vector2,
		Vector3,
		Vector4,
	},
})

function CameraRig() {
	const frame = useSimFrame()
	const camera = useThree((state) => state.camera)
	const gl = useThree((state) => state.gl)
	const connected = useThree((state) => state.events.connected) as
		HTMLElement | null | undefined
	const domElement = connected ?? gl.domElement

	const controls = useMemo(() => new CameraControlsImpl(camera), [camera])
	const director = useMemo(
		() =>
			camera instanceof PerspectiveCamera
				? new CameraDirector(controls, camera, frame, useSimStore)
				: null,
		[camera, controls, frame],
	)

	useEffect(() => {
		configureInput(controls, { pan: PAN_ENABLED })
		const removePinch = pinchAsDolly(controls, domElement)
		const removeShiftPan = PAN_ENABLED
			? shiftDragPans(controls, domElement)
			: () => undefined
		controls.connect(domElement)
		return () => {
			controls.disconnect()
			removePinch()
			removeShiftPan()
		}
	}, [controls, domElement])
	useEffect(() => () => controls.dispose(), [controls])

	useEffect(() => {
		if (director === null) return
		director.attach()
		const hide = exposeDebugHandle(director, gl.domElement)
		return () => {
			hide()
			director.detach()
		}
	}, [director, gl])

	useFrame((_state, delta) => {
		director?.tick(performance.now(), delta)
	}, CAMERA_FRAME_PRIORITY)

	return null
}

export default CameraRig
