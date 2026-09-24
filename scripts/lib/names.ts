/**
 * Name helpers shared by the data build and its tests.
 *
 * The two moon sources spell names differently ("Rhéa" vs "Rhea", "S/2003 J 24"),
 * so every comparison and every id goes through the same normalization.
 */

/** Lowercase ASCII letters and digits only: diacritics stripped, everything else dropped. */
export const normalizeName = (name: string): string =>
	name
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "")

/** Body id from an English display name: "S/2003 J 24" -> "s2003j24". Throws when nothing is left. */
export const slug = (name: string): string => {
	const id = normalizeName(name)
	if (id === "") {
		throw new Error(`Cannot derive a slug from ${JSON.stringify(name)}`)
	}
	return id
}
