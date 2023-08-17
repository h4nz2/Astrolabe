import { getTypedKeys } from "../../src/lib/getTypedKeys"
import { NexusGenObjects } from "generated/nexus-typegen-custom"
import { OurDatabase } from "../db"

export const getAllSolarDictionaryItems = (
	{ suns, planets }: OurDatabase,
	{ ids = [], names = [] }: { ids?: number[] | null; names?: string[] | null },
	demoEntityKeys: unknown[],
): NexusGenObjects["SolarDictionaryItem"][] => {
	const getSolarDictItems = (
		entities: typeof suns | typeof planets,
	): NexusGenObjects["SolarDictionaryItem"][] => {
		const items = entities.map((entity) => {
			const solarDictItem = getTypedKeys(entity).reduce<
				NexusGenObjects["SolarDictionaryItem"]
			>(
				(item, key) => {
					return demoEntityKeys.includes(key)
						? { ...item, [key]: entity[key] }
						: item
				},
				{} as NexusGenObjects["SolarDictionaryItem"],
			)
			return solarDictItem
		})
		return items
	}

	if (ids?.length || names?.length) {
		const itemsByIds = ids?.length
			? ids.map((id) =>
					id === 0
						? getSolarDictItems(suns)
						: getSolarDictItems(planets.filter((p) => p.id === id)),
			  )
			: []

		const getItemByName = (entityName: string) => {
			const regex = new RegExp(entityName, "i")
			return /sun/i.test(entityName)
				? getSolarDictItems(suns)
				: getSolarDictItems(planets.filter((p) => regex.test(p.name)))
		}
		const itemsByNames = names?.length
			? names.map((name) => getItemByName(name))
			: []

		return [...itemsByIds, ...itemsByNames].flat()
	}

	return [...getSolarDictItems(suns), ...getSolarDictItems(planets)]
}
