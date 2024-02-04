import { FC, useState } from "react"
import {
	SolarDictionaryQuery,
	useSolarDictionaryQuery,
} from "generated/graphql"
import Loader from "@/primitives/Loader"
import { Box, createStyles } from "@mantine/core"
import Navbar from "./components/Navbar"
import { getSidebarLabels } from "./utils/getSidebarLabels"
import Stage from "./components/Stage"

export type Texture = keyof NonNullable<
	SolarDictionaryQuery["solarDictionary"][number]["textures"]
>

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

type State = { activeEntityIndex: number; activeTexture: Texture }
const initialState: State = {
	activeEntityIndex: 0,
	activeTexture: defaultTexture,
}

const useStyles = createStyles({
	base: { width: "100%", height: "100vh" },
})

export type SolarDictionaryProps = {
	data?: SolarDictionaryQuery["solarDictionary"]
}

const SolarDictionary: FC<SolarDictionaryProps> = () => {
	const { classes } = useStyles()
	const { data, loading } = useSolarDictionaryQuery()

	const [{ activeEntityIndex, activeTexture }, setState] =
		useState<State>(initialState)

	const solarDict = data?.solarDictionary ?? []
	const currentEntity = solarDict[activeEntityIndex]

	const onEntityChange = (activeEntityIndex: number) =>
		setState({
			activeEntityIndex:
				activeEntityIndex > solarDict.length - 1 || activeEntityIndex < 0
					? 0
					: activeEntityIndex,
			activeTexture: defaultTexture,
		})

	const onTextureChange = (texture: Texture) =>
		setState((prev) => ({ ...prev, activeTexture: texture }))

	const labels = getSidebarLabels(
		currentEntity,
		activeEntityIndex === sunIdx ? requiredLabelsSun : requiredLabels,
		solarDict[earthIdx],
	)

	if (!currentEntity || loading) return <Loader />

	return (
		<Box className={classes.base}>
			<Navbar
				activeEntityIndex={activeEntityIndex}
				activeTexture={activeTexture}
				onChange={onEntityChange}
				onTextureChange={onTextureChange}
				solarDict={solarDict}
			/>
			<Stage
				texture={
					currentEntity.textures?.[activeTexture] ??
					currentEntity.textures?.[defaultTexture]
				}
				sidebarLabels={labels}
			/>
		</Box>
	)
}

export default SolarDictionary
