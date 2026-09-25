/**
 * The walk's numbers as people say them (#25): a length in the unit a ruler or
 * a map would use, rounded to what can be measured out on the ground, and the
 * few large numbers in words ("150 million km", "1 : 5.8 billion").
 *
 * Pure: the locale is a parameter (`I18n.formatLocale`).
 */
import { formatQuantity, type IntlUnit } from "@/i18n"

export type LengthUnit = Extract<
	IntlUnit,
	"millimeter" | "centimeter" | "meter" | "kilometer"
>

/** Each unit and how many metres it is, smallest first. */
const UNITS: readonly [LengthUnit, number][] = [
	["millimeter", 0.001],
	["centimeter", 0.01],
	["meter", 1],
	["kilometer", 1000],
]

/**
 * A number rounded to what matters for measuring out: two significant digits
 * below 10 ("2.2", "0.84", "6.6"), whole numbers from 10 ("26", "134", "775"),
 * two significant digits from 1000 ("6,900").
 */
export function roundReadable(value: number): number {
	if (!Number.isFinite(value) || value === 0) return value
	const abs = Math.abs(value)
	if (abs >= 10 && abs < 1000) return Math.round(value)
	const magnitude = 10 ** (Math.floor(Math.log10(abs)) - 1)
	return Math.round(value / magnitude) * magnitude
}

/**
 * A length in metres as a value in the unit people would use for it: mm below
 * 1 cm, cm below 1 m, m below 1 km, km beyond, rounded by `roundReadable`
 * (a value that rounds up to the next unit moves there: 999.6 m is 1 km).
 */
export function readableLength(metres: number): {
	value: number
	unit: LengthUnit
} {
	let i = UNITS.length - 1
	while (i > 0 && Math.abs(metres) < UNITS[i][1]) i--
	let value = roundReadable(metres / UNITS[i][1])
	if (
		i < UNITS.length - 1 &&
		Math.abs(value) * UNITS[i][1] >= UNITS[i + 1][1]
	) {
		i++
		value = roundReadable(metres / UNITS[i][1])
	}
	// clear binary noise such as 0.8400000000000001
	return { value: Number(value.toPrecision(12)), unit: UNITS[i][0] }
}

/** "2.2 mm", "26 m", "6,900 km" / "2,2 mm", "6.900 km". */
export function formatLength(metres: number, locale: string): string {
	const { value, unit } = readableLength(metres)
	return formatQuantity(value, unit, locale)
}

const compact = new Map<string, Intl.NumberFormat>()

function compactFormat(
	locale: string,
	options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
	const key = `${locale}|${JSON.stringify(options)}`
	let format = compact.get(key)
	if (format === undefined) {
		format = new Intl.NumberFormat(locale, options)
		compact.set(key, format)
	}
	return format
}

/**
 * A true distance or size in km, large ones in words: "12,742 km",
 * "149.6 million km" / "149,6 Millionen km".
 */
export function formatTrueKm(km: number, locale: string): string {
	if (km < 1e6) return formatQuantity(Math.round(km), "kilometer", locale)
	return compactFormat(locale, {
		style: "unit",
		unit: "kilometer",
		notation: "compact",
		compactDisplay: "long",
		maximumSignificantDigits: 4,
	}).format(km)
}

/** The n of a scale 1 : n, in words: "5.8 billion" / "5,8 Milliarden". */
export function formatScaleDenominator(n: number, locale: string): string {
	return compactFormat(locale, {
		notation: "compact",
		compactDisplay: "long",
		maximumSignificantDigits: 2,
	}).format(n)
}

/** Hours as said of a flight: half hours below 10 h, whole hours above. */
export const roundHours = (hours: number): number =>
	hours < 10 ? Math.max(0.5, Math.round(hours * 2) / 2) : Math.round(hours)

/** Minutes of walking, at least one. */
export const roundMinutes = (minutes: number): number =>
	Math.max(1, Math.round(minutes))

/** A count of landmark lengths: one decimal below 10 ("0.2", "7.4"), whole from 10 ("31"). */
export const roundCount = (count: number): number =>
	count < 10 ? Math.round(count * 10) / 10 : Math.round(count)
