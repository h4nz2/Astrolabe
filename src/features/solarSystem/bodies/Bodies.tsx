/**
 * Every body as a BodyMesh, keyed by id; moons by the curation rule
 * (`isBodyShown`: featured moons while `showMoons` is on, the long tail with
 * `showAllMoons` too, the focus always).
 */
import { isBodyShown, useSimStore } from "@/store/sim"

import { useSimFrame } from "../scene/simFrame"
import BodyMesh from "./BodyMesh"

function Bodies() {
	const frame = useSimFrame()
	const showMoons = useSimStore((state) => state.showMoons)
	const showAllMoons = useSimStore((state) => state.showAllMoons)
	const focusId = useSimStore((state) => state.focusId)

	return (
		<>
			{frame.bodies.map((body, index) =>
				isBodyShown(body, { showMoons, showAllMoons, focusId }) ? (
					<BodyMesh key={body.id} body={body} index={index} />
				) : null,
			)}
		</>
	)
}

export default Bodies
