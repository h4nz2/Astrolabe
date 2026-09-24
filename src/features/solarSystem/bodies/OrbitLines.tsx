/**
 * An OrbitLine for every orbiting body while `showOrbits` is on; moon orbits
 * only while `showMoons` is on as well, except the focus, whose orbit is always
 * drawn (`isBodyShown`).
 */
import { isBodyShown, useSimStore } from "@/store/sim"

import { useSimFrame } from "../scene/simFrame"
import OrbitLine from "./OrbitLine"

function OrbitLines() {
	const frame = useSimFrame()
	const showOrbits = useSimStore((state) => state.showOrbits)
	const showMoons = useSimStore((state) => state.showMoons)
	const focusId = useSimStore((state) => state.focusId)

	if (!showOrbits) return null

	return (
		<>
			{frame.bodies.map((body, index) => {
				if (body.orbit === null || body.parentId === null) return null
				if (!isBodyShown(body, { showMoons, focusId })) return null
				const parentIndex = frame.index.get(body.parentId)
				if (parentIndex === undefined) return null
				return (
					<OrbitLine
						key={body.id}
						body={body}
						index={index}
						parentIndex={parentIndex}
					/>
				)
			})}
		</>
	)
}

export default OrbitLines
