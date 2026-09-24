import type { FC } from "react"

import { EffectComposer, DepthOfField } from "@react-three/postprocessing"
import { BlendFunction } from "postprocessing"

import CircleLens from "./effects/CircleLens"

// No explicit `height`: the DoF render targets follow the composer (canvas) size. The old
// window.innerHeight value made postprocessing derive a target width of
// height * canvasAspect, which on this wide, short canvas exceeded MAX_TEXTURE_SIZE after
// any resize and blacked the scene out.
export const Effects: FC = () => {
	return (
		<EffectComposer multisampling={0} autoClear>
			<DepthOfField
				focusDistance={1}
				focalLength={0.05}
				bokehScale={1.1}
				blendFunction={BlendFunction.DARKEN}
				blur={1}
			/>
			<CircleLens fragments={7} />
		</EffectComposer>
	)
}

export default Effects
