import { FC, memo } from "react"
import { Box } from "@mantine/core"
import Scene from "../THREE/Scene"
import Sidebar, { SidebarLabel } from "../components/Sidebar"
import classes from "./Stage.module.css"

export type StageProps = {
	texture?: string
	sidebarLabels: SidebarLabel[]
}

const Stage: FC<StageProps> = ({ texture, sidebarLabels }) => {
	return (
		<Box className={classes.base}>
			<Scene texture={texture} />
			<Sidebar labels={sidebarLabels} />
		</Box>
	)
}

export default memo(Stage)
