import { Group, Switch } from "@mantine/core"

import { useI18n } from "@/i18n"
import { useLightingStore } from "@/store/lighting"
import { useSimStore } from "@/store/sim"

/** Switches for the orbit lines, the labels, the moons, the markers, the orbit names and the "always lit" teaching mode. */
const SceneToggles = () => {
	const { t } = useI18n()
	const showOrbits = useSimStore((state) => state.showOrbits)
	const showLabels = useSimStore((state) => state.showLabels)
	const showMoons = useSimStore((state) => state.showMoons)
	const showMarkers = useSimStore((state) => state.showMarkers)
	const showOrbitLabels = useSimStore((state) => state.showOrbitLabels)
	const setShowOrbits = useSimStore((state) => state.setShowOrbits)
	const setShowLabels = useSimStore((state) => state.setShowLabels)
	const setShowMoons = useSimStore((state) => state.setShowMoons)
	const setShowMarkers = useSimStore((state) => state.setShowMarkers)
	const setShowOrbitLabels = useSimStore((state) => state.setShowOrbitLabels)
	const alwaysLit = useLightingStore((state) => state.alwaysLit)
	const setAlwaysLit = useLightingStore((state) => state.setAlwaysLit)

	return (
		<Group
			gap="md"
			wrap="wrap"
			role="group"
			aria-label={t("solarSystem.layers.label")}
		>
			<Switch
				size="xs"
				color="orange"
				label={t("solarSystem.layers.orbits")}
				checked={showOrbits}
				onChange={(event) => setShowOrbits(event.currentTarget.checked)}
			/>
			<Switch
				size="xs"
				color="orange"
				label={t("solarSystem.layers.labels")}
				checked={showLabels}
				onChange={(event) => setShowLabels(event.currentTarget.checked)}
			/>
			<Switch
				size="xs"
				color="orange"
				label={t("solarSystem.layers.moons")}
				checked={showMoons}
				onChange={(event) => setShowMoons(event.currentTarget.checked)}
			/>
			<Switch
				size="xs"
				color="orange"
				label={t("solarSystem.layers.markers")}
				checked={showMarkers}
				onChange={(event) => setShowMarkers(event.currentTarget.checked)}
			/>
			<Switch
				size="xs"
				color="orange"
				label={t("solarSystem.layers.orbitNames")}
				checked={showOrbitLabels}
				disabled={!showOrbits || !showLabels}
				onChange={(event) => setShowOrbitLabels(event.currentTarget.checked)}
			/>
			<Switch
				size="xs"
				color="orange"
				label={t("solarSystem.layers.alwaysLit")}
				checked={alwaysLit}
				onChange={(event) => setAlwaysLit(event.currentTarget.checked)}
			/>
		</Group>
	)
}

export default SceneToggles
