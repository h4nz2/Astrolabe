import { FC } from "react"
import { Box, createStyles } from "@mantine/core"
import type { SolarDictionaryQuery } from "generated/graphql"
import PrevNextButton from "./PrevNextButton"
import { useState } from "react"
import { getTypedKeys } from "@/lib/getTypedKeys"
import SelectTexture from "./SelectTexture"
import { Texture } from ".."

const useStyles = createStyles((theme) => ({
	base: {
		padding: "4rem 0",
		position: "absolute",
		minWidth: "300px",
		top: 40,
		left: 0,
		right: 0,
		background: theme.fn.rgba(theme.colors.dark[7], 0.2),
		zIndex: 2,
	},
	inner: {
		display: "flex",
		justifyContent: "center",
		gap: "clamp(16px, 4vw, 24px)",
	},
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
	const onPrev = () => onChange(activeEntityIndex - 1)
	const onNext = () => onChange(activeEntityIndex + 1)

	return (
		<Box className={classes.base}>
			<PrevNextButton
				prev
				disabled={activeEntityIndex === 0}
				onClick={onPrev}
			/>
			<Box className={classes.inner}>
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
			<PrevNextButton
				disabled={activeEntityIndex === solarDict.length - 1}
				onClick={onNext}
			/>
		</Box>
	)
}

export default Navbar
