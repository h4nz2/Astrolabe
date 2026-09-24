import { FC } from "react"
import { Box } from "@mantine/core"
import { getRouteApi } from "@tanstack/react-router"
import {
	useSolarDictionary,
	type SolarDictionaryItem,
	type Textures,
} from "@/data/solarDictionary"
import Loader from "@/primitives/Loader"
import Navbar from "./components/Navbar"
import { getSidebarLabels } from "./utils/getSidebarLabels"
import Stage from "./components/Stage"

export type Texture = keyof Textures

const defaultTexture: Texture = "base"

const requiredLabelsSun = ["name", "diameter", "gravity", "avgTemp"]

const requiredLabels = [
	"name",
	"diameter",
	"lengthOfDay",
	"orbitalPeriod",
	"gravity",
	"avgTemp",
]
const sunIdx = 0
const earthIdx = 3

// The selection is URL state (`?entity=3&texture=topo`, validated in
// src/routes/solar_dictionary.tsx) so every body can be deep-linked.
const route = getRouteApi("/solar_dictionary")

export type SolarDictionaryProps = {
	data?: SolarDictionaryItem[]
}

const SolarDictionary: FC<SolarDictionaryProps> = () => {
	const { data: solarDict, loading } = useSolarDictionary()

	const {
		entity: activeEntityIndex = sunIdx,
		texture: requestedTexture = defaultTexture,
	} = route.useSearch()
	const navigate = route.useNavigate()

	const currentEntity = solarDict[activeEntityIndex]

	// a valid texture name the body does not have (`?entity=1&texture=topo`) falls back to
	// base for the menu and the stage alike, so the highlighted item is always the shown one
	const activeTexture: Texture = currentEntity?.textures?.[requestedTexture]
		? requestedTexture
		: defaultTexture

	// a newly selected body always starts on its base texture; defaults stay out of the URL
	const onEntityChange = (newIndex: number) => {
		const entity =
			newIndex > solarDict.length - 1 || newIndex < 0 ? sunIdx : newIndex
		void navigate({
			search: { entity: entity === sunIdx ? undefined : entity },
			replace: true,
		})
	}

	const onTextureChange = (texture: Texture) =>
		void navigate({
			search: (prev) => ({
				...prev,
				texture: texture === defaultTexture ? undefined : texture,
			}),
			replace: true,
		})

	const labels = getSidebarLabels(
		currentEntity,
		activeEntityIndex === sunIdx ? requiredLabelsSun : requiredLabels,
		solarDict[earthIdx],
	)

	if (!currentEntity || loading) return <Loader />

	return (
		<Box w="100%" h="100vh">
			<Navbar
				activeEntityIndex={activeEntityIndex}
				activeTexture={activeTexture}
				onChange={onEntityChange}
				onTextureChange={onTextureChange}
				solarDict={solarDict}
			/>
			<Stage
				texture={currentEntity.textures?.[activeTexture] ?? undefined}
				sidebarLabels={labels}
			/>
		</Box>
	)
}

export default SolarDictionary
