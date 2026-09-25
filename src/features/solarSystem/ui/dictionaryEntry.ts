import { planets, sun } from "@/data"

/**
 * The index of a body's entry in the visual dictionary
 * (`/solar_dictionary?entity=<index>`), or null when it has none: the Sun is 0,
 * the planets 1..8 from the Sun outwards (`src/data/solarDictionary.ts`).
 * Worked out from the body model, so the solar system page never loads the
 * dictionary's data.
 */
export function dictionaryEntry(id: string): number | null {
	if (id === sun.id) return 0
	const index = planets.findIndex((planet) => planet.id === id)
	return index < 0 ? null : index + 1
}
