import { FC } from "react"
import { useSolarDictionaryQuery } from "generated/graphql"
import Loader from "@/primitives/Loader"
import Stage from "./Stage"

export type solarDictionaryProps = {}

const SolarDictionary: FC<solarDictionaryProps> = () => {
	const { data, loading } = useSolarDictionaryQuery()
	const solarDict = data?.solarDictionary

	if (!solarDict || loading) return <Loader />

	return <Stage solarDict={solarDict} />
}

export default SolarDictionary
