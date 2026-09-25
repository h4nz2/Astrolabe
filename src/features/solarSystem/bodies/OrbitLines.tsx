/**
 * An OrbitLine for every orbiting body while `showOrbits` is on; moon orbits
 * by the same rule as the moons themselves (`isBodyShown`); the focus's orbit
 * is always drawn.
 */
import { isBodyShown, useSimStore } from "@/store/sim"

import { useSimFrame } from "../scene/simFrame"
import OrbitLine from "./OrbitLine"

function OrbitLines() {
	const frame = useSimFrame()
	const showOrbits = useSimStore((state) => state.showOrbits)
	const showMoons = useSimStore((state) => state.showMoons)
	const showAllMoons = useSimStore((state) => state.showAllMoons)
	const focusId = useSimStore((state) => state.focusId)

	if (!showOrbits) return null

	return (
		<>
			{frame.bodies.map((body, index) => {
				if (body.orbit === null || body.parentId === null) return null
				if (!isBodyShown(body, { showMoons, showAllMoons, focusId }))
					return null
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
