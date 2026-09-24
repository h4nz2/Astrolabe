/** Number and date formatting shared by the HUD panels. */

const pad = (value: number, width = 2): string =>
	String(Math.abs(Math.trunc(value))).padStart(width, "0")

/**
 * `2026-09-24 10:35 UTC`. Years outside 0..9999 keep their sign and all their
 * digits; a Date beyond the representable range (an invalid Date) becomes a dash.
 */
export function formatUTC(date: Date): string {
	if (!Number.isFinite(date.getTime())) return "—"
	const year = date.getUTCFullYear()
	const sign = year < 0 ? "-" : ""
	const day = `${sign}${pad(year, 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
	return `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
}

/** Decimals worth showing for a magnitude: none from 1000 up, three below 1. */
const fractionDigitsFor = (abs: number): number =>
	abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 1 ? 2 : 3

const numberFormats = new Map<number, Intl.NumberFormat>()

/** Thousands separators and magnitude-dependent decimals: 149,598,261 / 365.3 / 27.32 / 0.295. */
export function formatNumber(value: number): string {
	if (!Number.isFinite(value)) return "—"
	const digits = fractionDigitsFor(Math.abs(value))
	let format = numberFormats.get(digits)
	if (format === undefined) {
		format = new Intl.NumberFormat("en-US", { maximumFractionDigits: digits })
		numberFormats.set(digits, format)
	}
	return format.format(value)
}

const auFormat = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 })

/** Astronomical units to 4 significant digits: 1 / 5.203 / 0.00257. */
export const formatAu = (au: number): string =>
	Number.isFinite(au) ? auFormat.format(au) : "—"
