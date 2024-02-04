import { FC } from "react"
import { Box, createStyles } from "@mantine/core"
import type { SolarDictionaryQuery } from "generated/graphql"
import { useState } from "react"
import { getTypedKeys } from "@/lib/getTypedKeys"
import SelectTexture from "./SelectTexture"
import { Texture } from ".."

const useStyles = createStyles((theme) => ({
	base: {
		position: "absolute",
		minWidth: "300px",
		top: "4rem",
		left: 0,
		right: 0,
		display: "flex",
		justifyContent: "center",
		gap: "clamp(16px, 4vw, 24px)",
		zIndex: 2,
	},
	inner: {},
}))

export type NavbarProps = {
	solarDict: SolarDictionaryQuery["solarDictionary"]
	activeEntityIndex: number
	onChange: (newIndex: number) => void
	activeTexture: Texture
	setActiveTexture: (texture: Texture) => void
}

const Navbar: FC<NavbarProps> = ({
	activeEntityIndex,
	activeTexture,
	onChange,
	setActiveTexture,
	solarDict,
}) => {
	const { classes } = useStyles()
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
					<SelectTexture
						key={entity.id}
						isActive={isActive}
						opened={isActive && openMenu}
						onChange={handleOnChange}
						textures={(entity.textures
							? getTypedKeys(entity.textures)
							: []
						).filter((t) => t !== "__typename" && !!entity.textures?.[t])}
						setActiveTexture={setActiveTexture}
						activeTexture={activeTexture}
					/>
				)
			})}
		</Box>
	)
}

export default Navbar
