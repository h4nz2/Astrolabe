import { FC, useState } from "react"
import {
	SolarDictionaryQuery,
	useSolarDictionaryQuery,
} from "generated/graphql"
import Loader from "@/primitives/Loader"
import { Box, createStyles } from "@mantine/core"

import { useRouter } from "next/router"
import type { ParsedUrlQuery } from "querystring"

import Navbar from "./components/Navbar"
import Scene from "./THREE/Scene"
import Sidebar from "./components/Sidebar"
import { getSidebarLabels } from "./utils/getSidebarLabels"

export type Texture = keyof NonNullable<
	SolarDictionaryQuery["solarDictionary"][number]["textures"]
>
type Query = ParsedUrlQuery & {
	activeEntity?: string
	texture?: Texture
}

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

const useStyles = createStyles({
	base: { width: "100%", height: "100vh" },
})
export type SolarDictionaryProps = {
	data?: SolarDictionaryQuery["solarDictionary"]
}

const SolarDictionary: FC<SolarDictionaryProps> = () => {
	const { classes } = useStyles()
	const { data, loading } = useSolarDictionaryQuery()

	const [{ activeEntity, activeTexture }, setState] = useState<{
		activeEntity: number
		activeTexture: Texture
	}>({
		activeEntity: 0,
		activeTexture: defaultTexture,
	})

	if (loading) return <Loader />

	const solarDict = data?.solarDictionary ?? []
	const onEntityChange = (activeEntityIndex: number) =>
		setState({
			activeEntity:
				activeEntityIndex > solarDict.length - 1 || activeEntityIndex < 0
					? 0
					: activeEntityIndex,
			activeTexture: defaultTexture,
		})

	const onTextureChange = (texture: Texture) =>
		setState((prev) => ({ ...prev, activeTexture: texture }))

	const planetOfReference = solarDict.findIndex((e) => e.name === "Earth")
	const labels = getSidebarLabels(
		solarDict[activeEntity],
		!activeEntity ? requiredLabelsSun : requiredLabels,
		solarDict[planetOfReference],
	)
	return (
		<Box className={classes.base}>
			<Navbar
				activeEntityIndex={activeEntity}
				activeTexture={activeTexture}
				onChange={onEntityChange}
				setActiveTexture={onTextureChange}
				solarDict={solarDict}
			/>
			{solarDict.map(({ id, textures }, i) => {
				const texture = textures?.[activeTexture] ?? textures?.[defaultTexture]
				return (
					<Box
						key={id}
						hidden={i !== activeEntity}
						sx={{ height: "100%", minWidth: "760px" }}
					>
						<Scene texture={texture} />
						<Sidebar labels={labels} />
					</Box>
				)
			})}
		</Box>
	)
}

export default SolarDictionary
