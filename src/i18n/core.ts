/**
 * The i18n object every component gets from `useI18n()` (and tests or non-React
 * code from `createI18n()`): a translator and formatters bound to one locale,
 * one reading level and one formatting locale.
 */
import {
	catalog,
	DEFAULT_LOCALE,
	DEFAULT_READING_LEVEL,
	LOCALES,
	type Locale,
	type MessageKey,
	type ReadingLevel,
} from "./catalog"
import {
	formatDateTimeUTC,
	formatNumber,
	formatQuantity,
	formatSignificant,
	type IntlUnit,
} from "./format"
import { formatMessage, lookupMessage, type MessageValues } from "./messages"
import { localeChain } from "./negotiate"

export interface I18n {
	/** Content language: a folder of src/locales ("en", "de"); also `<html lang>`. */
	readonly locale: Locale
	readonly readingLevel: ReadingLevel
	/** BCP 47 tag numbers and dates are formatted with ("de-CH" for a Swiss browser on "de"). */
	readonly formatLocale: string
	/** Where messages are looked up, most specific first (["de", "en"]). */
	readonly chain: readonly Locale[]
	/**
	 * The message for `key` at the active reading level, formatted with ICU
	 * MessageFormat (plurals, selects, numbers in the active locale). Falls back
	 * along the locale chain; returns the key itself if no locale has it.
	 */
	t(key: MessageKey, values?: MessageValues): string
	/** `formatNumber`: grouping and magnitude-dependent decimals. */
	number(value: number): string
	/** `formatSignificant`: 4 significant digits by default. */
	significant(value: number, digits?: number): string
	/** `formatQuantity`: "6,371 km", "365.3 days". */
	quantity(
		value: number,
		unit: IntlUnit,
		display?: "short" | "long" | "narrow",
	): string
	/** `formatDateTimeUTC`: "Sep 24, 2026, 10:35 UTC". */
	dateTimeUTC(date: Date): string
}

export interface I18nOptions {
	locale?: Locale
	readingLevel?: ReadingLevel
	/** Defaults to `locale`. */
	formatLocale?: string
}

/** A translator plus formatters for one locale and reading level. */
export function createI18n({
	locale = DEFAULT_LOCALE,
	readingLevel = DEFAULT_READING_LEVEL,
	formatLocale = locale,
}: I18nOptions = {}): I18n {
	const chain = localeChain(locale, LOCALES, DEFAULT_LOCALE)
	// a message that fell back to another language is formatted by that language's rules
	const formatterFor = (found: Locale): string =>
		found === locale ? formatLocale : found

	const t = (key: MessageKey, values?: MessageValues): string => {
		const found = lookupMessage(
			catalog,
			chain,
			key,
			readingLevel,
			DEFAULT_READING_LEVEL,
		)
		if (found === undefined) return key
		const text = formatMessage(found.text, formatterFor(found.locale), values)
		if (text !== undefined) return text
		// a broken translation (bad syntax, unknown argument): use the reference text
		const reference = lookupMessage(
			catalog,
			[DEFAULT_LOCALE],
			key,
			readingLevel,
			DEFAULT_READING_LEVEL,
		)
		return (
			(reference && formatMessage(reference.text, DEFAULT_LOCALE, values)) ??
			key
		)
	}

	return {
		locale,
		readingLevel,
		formatLocale,
		chain,
		t,
		number: (value) => formatNumber(value, formatLocale),
		significant: (value, digits) =>
			formatSignificant(value, formatLocale, digits),
		quantity: (value, unit, display) =>
			formatQuantity(value, unit, formatLocale, display),
		dateTimeUTC: (date) => formatDateTimeUTC(date, formatLocale),
	}
}
