import * as React from "react"
import { Box } from "@mantine/core"
import { useSolarDictionaryQuery } from "generated/graphql"

import Loader from "@/primitives/Loader"
import Stage from "./Stage"

export type solarDictionaryProps = {}

const SolarDictionary: React.FC<solarDictionaryProps> = () => {
	const [activeEntityIndex, setActiveEntityIndex] = React.useState(0)
	const onChange = (newIndex: number) => setActiveEntityIndex(newIndex)
	const { data, loading } = useSolarDictionaryQuery()
	const solarDict = data?.solarDictionary

	if (!solarDict || loading) return <Loader />

	return (
		<Box>
			<Stage
				solarDict={solarDict}
				activeEntityIndex={activeEntityIndex}
				onChange={onChange}
			/>
		</Box>
	)
}

export default SolarDictionary
