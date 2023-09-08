import { FC } from "react"
import { Box, createStyles, Menu } from "@mantine/core"
import type { SolarDictionaryQuery } from "generated/graphql"
import { PrevNextButton } from "./SliderArrow"
import { useState } from "react"
import { getTypedKeys } from "@/lib/getTypedKeys"
import { capitalize } from "lodash"

const useStyles = createStyles((theme) => ({
	base: {
		padding: "40px 0",
		position: "absolute",
		top: 40,
		left: 0,
		right: 0,
		background: theme.fn.rgba(theme.colors.dark[7], 0.2),
		zIndex: 2,
	},
	inner: {
		display: "flex",
		gap: "24px",
		justifyContent: "center",
	},
	sliderItem: {
		width: "24px",
		height: "24px",
		backgroundColor: "gray",
		marginBottom: "25px",
		borderRadius: "50%",
		cursor: "pointer",
		position: "relative",

		"&:hover": {
			"&:before": { borderColor: "rgba(255, 255, 255, 0.6)" },
		},
		"&:before": {
			content: "''",
			display: "block",
			position: "absolute",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			borderRadius: "100%",
			border: "5px solid rgba(255, 255, 255, 0.2)",
			opacity: 0,
			transition:
				"opacity 0.2s ease-in, border-color 0.2s ease-out, width 0.3s ease-in-out, height 0.4s ease-in-out",

			width: "100%",
			height: "100%",
		},
		"&.isActive": {
			backgroundColor: "white",
			"&:before": {
				opacity: 1,
				width: "250%",
				height: "250%",
			},
		},
	},
}))

export type NaviProps = {
	solarDict: SolarDictionaryQuery["solarDictionary"]
	activeEntityIndex: number
	onChange: (newIndex: number) => void
	activeTexture: string
	setActiveTexture: (
		texture: keyof NonNullable<
			SolarDictionaryQuery["solarDictionary"][number]["textures"]
		>,
	) => void
}

const Navi: FC<NaviProps> = ({
	activeEntityIndex,
	activeTexture,
	onChange,
	setActiveTexture,
	solarDict,
}) => {
	const { classes, cx } = useStyles()

	const [openMenu, setOpenMenu] = useState(false)
	const handlePrevBtnClick = () => onChange(activeEntityIndex - 1)
	const handleNextBtnClick = () => onChange(activeEntityIndex + 1)

	return (
		<Box className={classes.base}>
			<PrevNextButton
				prev
				disabled={activeEntityIndex === 0}
				onClick={handlePrevBtnClick}
			/>
			<Box className={classes.inner}>
				{solarDict.map((entity, i) => {
					const isActive = i === activeEntityIndex
					const handleOnChange = () => {
						if (isActive) setOpenMenu((o) => !o)
						else onChange(i)
					}
					return (
						<Menu
							key={i}
							shadow="md"
							opened={isActive && openMenu}
							onChange={handleOnChange}
							closeOnItemClick={false}
						>
							<Menu.Target>
								<Box key={i} className={cx(classes.sliderItem, { isActive })} />
							</Menu.Target>

							<Menu.Dropdown>
								<Menu.Label>Available Textures</Menu.Label>
								<Menu.Divider />

								{getTypedKeys(entity.textures ?? {})
									.filter((t) => t !== "__typename" && !!entity.textures?.[t])
									.map((texture) => (
										<MenuItem
											key={texture}
											label={capitalize(texture)}
											onClick={() => setActiveTexture(texture)}
											active={texture === activeTexture}
										/>
									))}
							</Menu.Dropdown>
						</Menu>
					)
				})}
			</Box>
			<PrevNextButton
				disabled={activeEntityIndex === solarDict.length - 1}
				onClick={handleNextBtnClick}
			/>
		</Box>
	)
}

export default Navi

const MenuItem: FC<{
	active?: boolean
	label: string
	onClick: () => void
}> = ({ active, label, onClick }) => (
	<Menu.Item
		onClick={onClick}
		sx={(theme) => ({
			transition: "color 0.3s ease-out",
			color: active ? theme.colors.red[4] : undefined,
			background: active ? theme.colors.dark[4] : undefined,
		})}
	>
		{label}
	</Menu.Item>
)
