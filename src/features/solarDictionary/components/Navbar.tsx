import { FC } from "react"
import { Box, createStyles, Menu } from "@mantine/core"
import type { SolarDictionaryQuery } from "generated/graphql"
import { useState } from "react"
import { getTypedKeys } from "@/lib/getTypedKeys"
import { Texture } from ".."

const useStyles = createStyles({
	base: {
		position: "absolute",
		minWidth: "300px",
		top: "4rem",
		left: 0,
		right: 0,
		display: "flex",
		justifyContent: "center",
		gap: "clamp(16px, 5vw, 24px)",
		zIndex: 2,
	},
	menuTarget: {
		width: "clamp(16px, 5vw, 24px)",
		height: "clamp(16px, 5vw, 24px)",
		backgroundColor: "gray",

		borderRadius: "50%",
		cursor: "pointer",
		position: "relative",

		"&:hover": {
			"&:before": {
				opacity: 1,
				width: "155%",
				height: "150%",
			},
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
				"opacity 0.5s ease, border-color 0.2s ease-out, width 0.25s ease, height 0.4s ease",
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
})

export type NavbarProps = {
	solarDict: SolarDictionaryQuery["solarDictionary"]
	activeEntityIndex: number
	onChange: (newIndex: number) => void
	activeTexture: Texture
	onTextureChange: (texture: Texture) => void
}

const Navbar: FC<NavbarProps> = ({
	activeEntityIndex,
	activeTexture,
	onChange,
	onTextureChange,
	solarDict,
}) => {
	const { classes, cx } = useStyles()
	const [openMenu, setOpenMenu] = useState(false)
	return (
		<Box className={classes.base}>
			{solarDict.map((entity, i) => {
				const isActive = i === activeEntityIndex
				const handleOnChange = () => {
					if (isActive) setOpenMenu((o) => !o)
					else onChange(i)
				}
				return (
					<Menu
						key={entity.id}
						shadow="md"
						opened={isActive && openMenu}
						onChange={handleOnChange}
						closeOnItemClick={false}
					>
						<Menu.Target>
							<Box className={cx(classes.menuTarget, { isActive })} />
						</Menu.Target>

						<Menu.Dropdown>
							<Menu.Label>Available Textures</Menu.Label>
							<Menu.Divider />

							{(entity.textures ? getTypedKeys(entity.textures) : [])
								.filter((t) => t !== "__typename" && !!entity.textures?.[t])
								.map((texture) => {
									const active = texture === activeTexture
									return (
										<Menu.Item
											key={texture}
											onClick={() => onTextureChange(texture)}
											sx={({ colors }) => ({
												transition: "color 0.3s ease-out",
												color: active ? colors.red[4] : undefined,
												background: active ? colors.dark[4] : undefined,
												textTransform: "capitalize",
											})}
											my={5}
										>
											{texture}
										</Menu.Item>
									)
								})}
						</Menu.Dropdown>
					</Menu>
				)
			})}
		</Box>
	)
}

export default Navbar
