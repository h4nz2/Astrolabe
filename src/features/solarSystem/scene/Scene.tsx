/**
 * The solar system Canvas (docs/ARCHITECTURE.md, "Rendering"). Creates the
 * SimFrame once and shares it below; SimClock is the only writer, everything
 * else reads it in its own useFrame. Effects (Bloom) arrive in Phase 6.
 */
import { Suspense, useMemo } from "react"
import { Canvas } from "@react-three/fiber"

import { bodies } from "@/data"
import { useSimStore } from "@/store/sim"

import Bodies from "../bodies/Bodies"
import OrbitLines from "../bodies/OrbitLines"
import CameraRig from "../camera/CameraRig"
import { CAMERA_FAR, CAMERA_FOV_DEG, CAMERA_NEAR } from "../camera/framing"
import Markers from "./Markers"
import SimClock from "./SimClock"
import { SimFrameContext, createSimFrame } from "./simFrame"

export const SCENE_BACKGROUND = "#0b0d12"
export const AMBIENT_INTENSITY = 0.05

function Scene() {
	const frame = useMemo(
		() => createSimFrame(bodies, useSimStore.getState().simTimeJD),
		[],
	)

	return (
		<Canvas
			dpr={[1, 2]}
			gl={{ logarithmicDepthBuffer: true, antialias: true }}
			camera={{
				near: CAMERA_NEAR,
				far: CAMERA_FAR,
				fov: CAMERA_FOV_DEG,
				position: [0, 20000, 20000],
			}}
			style={{ position: "absolute", inset: 0 }}
		>
			<color attach="background" args={[SCENE_BACKGROUND]} />
			<SimFrameContext.Provider value={frame}>
				<SimClock />
				<ambientLight intensity={AMBIENT_INTENSITY} />
				<Suspense fallback={null}>
					<Bodies />
				</Suspense>
				<OrbitLines />
				<Markers />
				<CameraRig />
			</SimFrameContext.Provider>
		</Canvas>
	)
}

export default Scene
