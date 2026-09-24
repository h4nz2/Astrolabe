/**
 * Jumping to a date (issue #14): the store action a jump uses and the
 * calendar's days and labels, formatted with `Intl` in the active locale so the
 * date picker needs no locale data of its own (pure, no React).
 */
import { dateToJD, jdToDate } from "@/sim"
import { useSimStore } from "@/store/sim"

/**
 * Travels to `jd` and stops there: the clock pauses first, so the glide
 * (`travelTo`, #9) sweeps every body along its path and lands still, and the
 * class sees the moment instead of racing past it. Play runs on from there at
 * the chosen speed and direction.
 */
export function travelAndStop(jd: number): void {
	if (!Number.isFinite(jd)) return
	const { setPaused, travelTo } = useSimStore.getState()
	setPaused(true)
	travelTo(jd)
}

/** A calendar day, "YYYY-MM-DD" (the date picker's value format). */
export type Day = string

/**
 * The range the date picker offers. The orbital elements are fixed at J2000,
 * so positions a few thousand years away are guesses; the Gregorian calendar
 * the dates are shown in also starts only in 1582.
 */
export const FIRST_DAY: Day = "1000-01-01"
export const LAST_DAY: Day = "2999-12-31"

/** The hour of the day (UTC) a picked day is travelled to. */
export const ARRIVAL_HOUR_UTC = 12

/** The UTC calendar day of a Julian Date, clamped into the picker's range. */
export function dayOf(jd: number): Day {
	const date = jdToDate(jd)
	if (!Number.isFinite(date.getTime())) return FIRST_DAY
	const day = date.toISOString().slice(0, 10)
	// ISO days compare as strings inside 0000..9999; outside, the sign or the
	// extra digits sort them wrong, so compare the years first
	const year = date.getUTCFullYear()
	if (year < 1000) return FIRST_DAY
	if (year > 2999) return LAST_DAY
	return day
}

/** The UTC midnight a day starts at; accepts "YYYY-MM-DD" and "YYYY-MM-DD HH:mm:ss". */
export function dayStart(day: Day): Date {
	const [year, month, date] = day.slice(0, 10).split("-").map(Number)
	return new Date(Date.UTC(year, month - 1, date))
}

/** The Julian Date a picked day is travelled to: its noon, UTC. */
export const arrivalJD = (day: Day): number =>
	dateToJD(dayStart(day)) + ARRIVAL_HOUR_UTC / 24

const formats = new Map<string, Intl.DateTimeFormat>()

/** A cached `Intl.DateTimeFormat` in UTC. */
function utcFormat(
	locale: string,
	options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
	const key = `${locale}|${JSON.stringify(options)}`
	let format = formats.get(key)
	if (format === undefined) {
		format = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" })
		formats.set(key, format)
	}
	return format
}

/** A date without the time in the locale's style: "Jul 20, 1969" / "20.07.1969". */
export const formatDayUTC = (date: Date, locale: string): string =>
	utcFormat(locale, { dateStyle: "medium" }).format(date)

/** Monday (1) or Sunday (0) etc.: the locale's first day of the week; Monday if unknown. */
export function firstDayOfWeek(locale: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
	try {
		const tag = new Intl.Locale(locale) as Intl.Locale & {
			getWeekInfo?: () => { firstDay: number }
			weekInfo?: { firstDay: number }
		}
		const first = (tag.getWeekInfo?.() ?? tag.weekInfo)?.firstDay
		// Intl counts Monday..Sunday as 1..7, the calendar Sunday..Saturday as 0..6
		if (first !== undefined) return (first % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6
	} catch {
		// an engine without Intl.Locale: fall through
	}
	return 1
}

/** The date picker's labels in the locale, from `Intl` (Mantine's `*Format` props). */
export function calendarLabels(locale: string) {
	const format = (options: Intl.DateTimeFormatOptions) => (day: Day) =>
		utcFormat(locale, options).format(dayStart(day))
	return {
		/** Header of a month: "July 1969" / "Juli 1969". */
		monthLabelFormat: format({ month: "long", year: "numeric" }),
		/** Header of a year: "1969". */
		yearLabelFormat: format({ year: "numeric" }),
		/** Header of a decade: "1960 – 1969". */
		decadeLabelFormat: (start: Day, end: Day) =>
			`${format({ year: "numeric" })(start)} – ${format({ year: "numeric" })(end)}`,
		/** A month in the year grid: "Jul". */
		monthsListFormat: format({ month: "short" }),
		/** A year in the decade grid. */
		yearsListFormat: format({ year: "numeric" }),
		/** The weekday row: "Mon" / "Mo" (without the abbreviation's dot). */
		weekdayFormat: (day: Day) =>
			utcFormat(locale, { weekday: "short" })
				.format(dayStart(day))
				.replace(/\.$/, ""),
		/** A day's accessible name: "Sunday, July 20, 1969". */
		getDayAriaLabel: format({ dateStyle: "full" }),
	}
}
