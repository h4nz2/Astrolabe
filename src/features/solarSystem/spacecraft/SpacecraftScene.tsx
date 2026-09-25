/**
 * Everything spacecraft inside the Canvas (issue #35, docs/ARCHITECTURE.md,
 * "Spacecraft"): moves the CraftFrame on with the SimFrame every frame, then
 * draws the markers and the paths. The names are laid out with the bodies'
 * (./craftLabels.ts) and written by ./SpacecraftLabelLayer.tsx.
 */
import { useEffect } from "react"
import { useFrame } from "@react-three/fiber"

import type { LabelLayout } from "../labels/layout"
import type { SimFrame } from "../scene/simFrame"
import {
	CRAFT_FRAME_PRIORITY,
	updateCraftFrame,
	type CraftFrame,
} from "./craftFrame"
import CraftMarkers from "./CraftMarkers"
import CraftPaths from "./CraftPaths"
import { loadTrajectories } from "./trajectories"

export interface SpacecraftSceneProps {
	frame: SimFrame
	craftFrame: CraftFrame
	labels?: { layout: LabelLayout; firstSlot: number }
}

function SpacecraftScene({ frame, craftFrame, labels }: SpacecraftSceneProps) {
	// the trajectories arrive after the scene is up (a separate chunk)
	useEffect(() => {
		void loadTrajectories()
	}, [])
	useFrame(() => updateCraftFrame(craftFrame, frame), CRAFT_FRAME_PRIORITY)
	return (
		<>
			<CraftPaths frame={frame} craftFrame={craftFrame} />
			<CraftMarkers frame={frame} craftFrame={craftFrame} labels={labels} />
		</>
	)
}

export default SpacecraftScene
