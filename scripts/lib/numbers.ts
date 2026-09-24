import { isRecord } from "./source"

/** Unicode minus (U+2212) and en dash (U+2013), both used as a minus sign in the source. */
const MINUS_SIGNS = /[\u2212\u2013]/g
const WHITESPACE = /[\s\u00a0\u202f]/g

/**
 * A number as written in the source: `-640.38`, `"-640.38"`, `"\u2212763.95"` (unicode minus).
 * Returns null for anything that is not a finite number.
 */
export const parseNumber = (value: unknown): number | null => {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null
	}
	if (typeof value !== "string") return null
	const text = value.replace(MINUS_SIGNS, "-").replace(WHITESPACE, "")
	if (text === "") return null
	const parsed = Number(text)
	return Number.isFinite(parsed) ? parsed : null
}

/** mantissa * 10^exponent without binary round-off noise for plain decimal mantissas. */
const scaled = (mantissa: string | number, exponent: number): number => {
	const text = String(mantissa)
	return /e/i.test(text)
		? Number(text) * 10 ** exponent
		: Number(`${text}e${exponent}`)
}

const finitePositive = (value: number): number | null =>
	Number.isFinite(value) && value > 0 ? value : null

/** "4.799844 * 10^22", "13 × 10^16", "4.8e22", "1.075938*10^23", or a plain "5e24". */
const SCIENTIFIC = /^(-?\d+(?:\.\d+)?)(?:(?:[*×x·]10\^|e)(-?\d+))?$/i

/**
 * Mass in kg from any of the source spellings:
 * `{ massValue: 4.8, massExponent: 22 }`, `"4.799844 * 10^22"`, `"1.075938 * 10^23"`,
 * `"0.2 * 10^16"`, `"4.8e22"` or a plain number. Null when missing, unparsable or not > 0.
 */
export const parseMass = (value: unknown): number | null => {
	if (typeof value === "number") return finitePositive(value)
	if (typeof value === "string") {
		const text = value.replace(MINUS_SIGNS, "-").replace(WHITESPACE, "")
		const match = SCIENTIFIC.exec(text)
		if (!match) return null
		return finitePositive(scaled(match[1], Number(match[2] ?? "0")))
	}
	if (isRecord(value)) {
		const { massValue, massExponent } = value
		if (
			typeof massValue === "number" &&
			Number.isFinite(massValue) &&
			typeof massExponent === "number" &&
			Number.isInteger(massExponent)
		) {
			return finitePositive(scaled(massValue, massExponent))
		}
	}
	return null
}
