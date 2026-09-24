/**
 * Loose accessors for the raw data/ourDB.json records.
 *
 * The export mixes API fields, hand-curated fields and typos (numbers as strings,
 * unicode minus signs, 0 meaning "unknown"), so every field is read defensively
 * instead of trusting a declared shape.
 */

export type Raw = Record<string, unknown>

export const isRecord = (value: unknown): value is Raw =>
	typeof value === "object" && value !== null && !Array.isArray(value)

export const rec = (value: unknown): Raw | null =>
	isRecord(value) ? value : null

export const records = (value: unknown): Raw[] =>
	Array.isArray(value) ? value.filter(isRecord) : []

/** A finite number, or null. */
export const num = (value: unknown): number | null =>
	typeof value === "number" && Number.isFinite(value) ? value : null

/** A finite number > 0, or null (the source uses 0 for "unknown"). */
export const positive = (value: number | null): number | null =>
	value !== null && value > 0 ? value : null

/** A finite number != 0, or null. */
export const nonZero = (value: number | null): number | null =>
	value !== null && value !== 0 ? value : null

/** |value| when it is a finite number != 0, or null. */
export const positiveAbs = (value: number | null): number | null =>
	value !== null && value !== 0 ? Math.abs(value) : null

/** A trimmed non-empty string, or null. */
export const str = (value: unknown): string | null => {
	if (typeof value !== "string") return null
	const text = value.trim()
	return text === "" ? null : text
}

/** The first non-null result of `get` over `items`, in order. */
export const first = <T>(
	items: readonly Raw[],
	get: (item: Raw) => T | null,
): T | null => {
	for (const item of items) {
		const value = get(item)
		if (value !== null) return value
	}
	return null
}
