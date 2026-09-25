/**
 * Every body as a BodyMesh, keyed by id; moons only while `showMoons` is on,
 * except the focus, which is always rendered (`isBodyShown`).
 */
import { isBodyShown, useSimStore } from "@/store/sim"

import { useSimFrame } from "../scene/simFrame"
import BodyMesh from "./BodyMesh"

function Bodies() {
	const frame = useSimFrame()
	const showMoons = useSimStore((state) => state.showMoons)
	const focusId = useSimStore((state) => state.focusId)
	const showSmallBodies = useSimStore((state) => state.showSmallBodies)

	return (
		<>
			{frame.bodies.map((body, index) =>
				isBodyShown(body, { showMoons, focusId, showSmallBodies }) ? (
					<BodyMesh key={body.id} body={body} index={index} />
				) : null,
			)}
		</>
	)
}

export default Bodies
