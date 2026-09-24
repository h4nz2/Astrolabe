import type { SolarDictionaryItem } from "@/data/solarDictionary"

/**
 * The body id (src/data/bodies.json) of a dictionary entry, which keys its
 * translated name and written content: "Sun" -> "sun", "Earth" -> "earth".
 */
export const dictionaryBodyId = (item: Pick<SolarDictionaryItem, "name">) =>
	item.name.toLowerCase()
