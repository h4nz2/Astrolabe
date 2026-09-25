import { useEffect } from "react"
import { useThree } from "@react-three/fiber"

import { setSceneCapture, snapshotScene } from "./capture"

/**
 * Lends the postcard (#33) the renderer, scene and camera, so a click outside
 * the Canvas can take a picture. Costs nothing per frame: no useFrame and no
 * preserved drawing buffer; the picture is rendered only when asked for.
 */
function SceneCapture() {
	const gl = useThree((state) => state.gl)
	const scene = useThree((state) => state.scene)
	const camera = useThree((state) => state.camera)
	useEffect(
		() => setSceneCapture(() => snapshotScene(gl, scene, camera)),
		[gl, scene, camera],
	)
	return null
}

export default SceneCapture
