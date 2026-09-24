/**
 * The solar system Canvas (docs/ARCHITECTURE.md, "Rendering"). Creates the
 * SimFrame once and shares it below; SimClock is the only writer, everything
 * else reads it in its own useFrame. Effects (Bloom) arrive in Phase 6.
 * No three.js lights: the Sun lights every body through the sunlight model
 * (../lighting, docs/ARCHITECTURE.md, "Lighting").
 */
import { Suspense, useMemo } from "react"
import { Canvas } from "@react-three/fiber"

import { bodies } from "@/data"
import { useScaleStore } from "@/store/scale"
import { useSimStore } from "@/store/sim"

import Bodies from "../bodies/Bodies"
import OrbitLines from "../bodies/OrbitLines"
import CameraRig from "../camera/CameraRig"
import { CAMERA_FAR, CAMERA_FOV_DEG, CAMERA_NEAR } from "../camera/framing"
import BodyPicking from "./BodyPicking"
import HighlightTracker from "./HighlightTracker"
import HoverCursor from "./HoverCursor"
import Markers from "./Markers"
import ScaleSync from "./ScaleSync"
import SimClock from "./SimClock"
import { SimFrameContext, createSimFrame } from "./simFrame"

export const SCENE_BACKGROUND = "#0b0d12"

function Scene() {
	const frame = useMemo(
		() =>
			createSimFrame(
				bodies,
				useSimStore.getState().simTimeJD,
				useScaleStore.getState().scale,
			),
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
				<ScaleSync />
				<SimClock />
				<HoverCursor />
				<Suspense fallback={null}>
					<Bodies />
				</Suspense>
				<OrbitLines />
				<Markers />
				<BodyPicking />
				<CameraRig />
				<HighlightTracker />
			</SimFrameContext.Provider>
		</Canvas>
	)
}

export default Scene
