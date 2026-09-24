import { Group, Switch } from "@mantine/core"

import { useSimStore } from "@/store/sim"

/** Switches for the orbit lines, the labels, the moons and the markers. */
const SceneToggles = () => {
	const showOrbits = useSimStore((state) => state.showOrbits)
	const showLabels = useSimStore((state) => state.showLabels)
	const showMoons = useSimStore((state) => state.showMoons)
	const showMarkers = useSimStore((state) => state.showMarkers)
	const setShowOrbits = useSimStore((state) => state.setShowOrbits)
	const setShowLabels = useSimStore((state) => state.setShowLabels)
	const setShowMoons = useSimStore((state) => state.setShowMoons)
	const setShowMarkers = useSimStore((state) => state.setShowMarkers)

	return (
		<Group gap="md" wrap="wrap" role="group" aria-label="Scene layers">
			<Switch
				size="xs"
				color="orange"
				label="Orbits"
				checked={showOrbits}
				onChange={(event) => setShowOrbits(event.currentTarget.checked)}
			/>
			<Switch
				size="xs"
				color="orange"
				label="Labels"
				checked={showLabels}
				onChange={(event) => setShowLabels(event.currentTarget.checked)}
			/>
			<Switch
				size="xs"
				color="orange"
				label="Moons"
				checked={showMoons}
				onChange={(event) => setShowMoons(event.currentTarget.checked)}
			/>
			<Switch
				size="xs"
				color="orange"
				label="Markers"
				checked={showMarkers}
				onChange={(event) => setShowMarkers(event.currentTarget.checked)}
			/>
		</Group>
	)
}

export default SceneToggles
