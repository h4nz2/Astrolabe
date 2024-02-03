import { FC } from "react"
import { Box, createStyles, Menu } from "@mantine/core"
import { Texture } from ".."

const useStyles = createStyles({
	menuTarget: {
		width: "clamp(16px, 4vw, 24px)",
		minWidth: "16px",
		height: "clamp(16px, 4vw, 24px)",
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

export type SelectTextureProps = {
	opened?: boolean
	isActive?: boolean
	onChange: () => void
	textures?: Texture[]
	activeTexture: Texture
	setActiveTexture: (texture: Texture) => void
}

const SelectTexture: FC<SelectTextureProps> = ({
	isActive,
	onChange,
	opened,
	textures = [],
	activeTexture,
	setActiveTexture,
}) => {
	const { classes, cx } = useStyles()

	return (
		<Menu
			shadow="md"
			opened={opened}
			onChange={onChange}
			closeOnItemClick={false}
		>
			<Menu.Target>
				<Box className={cx(classes.menuTarget, { isActive })} />
			</Menu.Target>

			<Menu.Dropdown>
				<Menu.Label>Available Textures</Menu.Label>
				<Menu.Divider />

				{textures.map((texture) => {
					const active = texture === activeTexture
					return (
						<Menu.Item
							key={texture}
							onClick={() => setActiveTexture(texture)}
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
}

export default SelectTexture
