import { FC, useState } from "react"
import { Box, Menu } from "@mantine/core"
import type { SolarDictionaryItem } from "@/data/solarDictionary"
import { getTypedKeys } from "@/lib/getTypedKeys"
import type { Texture } from ".."
import classes from "./Navbar.module.css"

export type NavbarProps = {
	solarDict: SolarDictionaryItem[]
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
							<Box className={classes.menuTarget} mod={{ active: isActive }} />
						</Menu.Target>

						<Menu.Dropdown>
							<Menu.Label>Available Textures</Menu.Label>
							<Menu.Divider />

							{(entity.textures ? getTypedKeys(entity.textures) : [])
								.filter((t) => !!entity.textures?.[t])
								.map((texture) => {
									const active = texture === activeTexture
									return (
										<Menu.Item
											key={texture}
											onClick={() => onTextureChange(texture)}
											className={classes.item}
											mod={{ active }}
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
