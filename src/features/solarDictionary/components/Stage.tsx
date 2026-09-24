import { FC, memo } from "react"
import { Box } from "@mantine/core"
import Scene from "../THREE/Scene"
import Sidebar from "../components/Sidebar"
import type { SidebarFact } from "../utils/getSidebarLabels"
import BodyDescription from "./BodyDescription"
import classes from "./Stage.module.css"

export type StageProps = {
	texture?: string
	facts: SidebarFact[]
	/** Body id (src/data/bodies.json) of the shown entry, for its written description. */
	bodyId: string
}

const Stage: FC<StageProps> = ({ texture, facts, bodyId }) => {
	return (
		<Box className={classes.base}>
			<Scene texture={texture} />
			<Sidebar facts={facts} />
			<BodyDescription bodyId={bodyId} />
		</Box>
	)
}

export default memo(Stage)
