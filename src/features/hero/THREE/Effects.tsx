import type { FC } from "react"

import { EffectComposer, DepthOfField } from "@react-three/postprocessing"
import { BlendFunction, GlitchMode } from "postprocessing"

import CircleLens from "./effects/CircleLens"
import { useWindowSize } from "@/hooks/useWindowSize"

export const Effects: FC = () => {
	const { height } = useWindowSize()
	return (
		<EffectComposer multisampling={0} autoClear>
			<DepthOfField
				focusDistance={1}
				focalLength={0.05}
				bokehScale={1.1}
				height={height}
				blendFunction={BlendFunction.DARKEN}
				blur={1}
			/>
			<CircleLens fragments={7} />
		</EffectComposer>
	)
}

export default Effects
