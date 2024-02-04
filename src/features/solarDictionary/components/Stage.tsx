import { FC, memo } from "react"
import { Box, createStyles } from "@mantine/core"
import Scene from "../THREE/Scene"
import Sidebar, { SidebarLabel } from "../components/Sidebar"

const useStyles = createStyles({
	base: { height: "100%", minWidth: "760px" },
})
export type StageProps = {
	texture?: string
	sidebarLabels: SidebarLabel[]
}

const Stage: FC<StageProps> = ({ texture, sidebarLabels }) => {
	const { classes } = useStyles()

	return (
		<Box className={classes.base}>
			<Scene texture={texture} />
			<Sidebar labels={sidebarLabels} />
		</Box>
	)
}

export default memo(Stage)
