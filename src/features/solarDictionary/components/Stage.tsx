import { FC, useCallback, useMemo } from "react"
import { Box, createStyles } from "@mantine/core"
import StageLabel from "./StageLabel"
import type { SolarDictionaryQuery } from "generated/graphql"
import { useStageLabels } from "../hooks/useStageLabels"
import Scene from "../THREE/Scene"
import Navi from "./Navi"
import { useRouter } from "next/router"
import { ParsedUrlQuery } from "querystring"
import { setQueryOnPage } from "@/utils/setQueryOnPage"

const useStyles = createStyles({
	base: { width: "100%", height: "100vh" },
	container: {
		position: "fixed",
		top: "10rem",
		left: "2rem",
		fontFamily: "arial",
		width: "20ch",
		display: "flex",
		flexDirection: "column",
	},
})

type Query = ParsedUrlQuery & {
	activeEntity?: string
	texture?: Texture
}
export type Texture = keyof NonNullable<
	SolarDictionaryQuery["solarDictionary"][number]["textures"]
>

export type StageProps = {
	solarDict: SolarDictionaryQuery["solarDictionary"]
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

const Stage: FC<StageProps> = ({ solarDict }) => {
	const { classes } = useStyles()
	const router = useRouter()
	const query = router.query as Query

	const onEntityChange = useCallback(
		(newIndex: number) =>
			setQueryOnPage(router, { activeEntity: newIndex ? newIndex : [] }),
		[router],
	)

	const activeEntity = useMemo(() => {
		const activeEntity = Number(query.activeEntity ?? 0)
		if (
			(!!activeEntity && !Number(activeEntity)) ||
			activeEntity > solarDict.length - 1 ||
			activeEntity < 0
		) {
			onEntityChange(0)
			return 0
		}

		return activeEntity
	}, [onEntityChange, query, solarDict.length])

	const labels = useStageLabels(
		solarDict[activeEntity],
		!activeEntity ? requiredLabelsSun : requiredLabels,
	)

	const onTextureChange = useCallback(
		(texture: Texture) =>
			setQueryOnPage(router, {
				texture: texture === defaultTexture ? [] : texture,
			}),
		[router],
	)
	const activeTexture: Texture = query.texture ?? defaultTexture
	return (
		<Box className={classes.base}>
			<Navi
				activeEntityIndex={activeEntity}
				activeTexture={activeTexture}
				onChange={onEntityChange}
				setActiveTexture={onTextureChange}
				solarDict={solarDict}
			/>

			{solarDict.map(({ textures }, i) => {
				const texture = textures?.[activeTexture] ?? textures?.[defaultTexture]
				return (
					<Box
						key={i}
						hidden={i !== activeEntity}
						sx={{ height: "100%", minWidth: "760px" }}
					>
						<Scene texture={texture} />
						<Box className={classes.container}>
							{labels.map((label) =>
								Object.entries(label).map(([label, value]) =>
									value ? (
										<StageLabel
											key={label}
											label={label}
											text={value[0]}
											extra={activeEntity === 3 ? null : value[1]}
											small={!/name/i.test(label)}
										/>
									) : null,
								),
							)}
						</Box>
					</Box>
				)
			})}
		</Box>
	)
}

export default Stage
