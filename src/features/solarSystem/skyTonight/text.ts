/**
 * The words of "What is in the sky tonight" (#36), pure so every sentence can
 * be tested in each locale and reading level. Components pass `useI18n()` and
 * `useBodyName()`; tests pass `createI18n()` and `bodyName`.
 *
 * Times are shown in the place's time zone, rounded to five minutes (the
 * sky does not need more, and "about 21:35" reads better than "21:37").
 */
import type { I18n } from "@/i18n"

import {
	compassOf,
	fistsOf,
	heightOf,
	type Sighting,
	type SkyPosition,
	type SkyTonight,
} from "./sky"

type Name = (id: string) => string

const FIVE_MINUTES = 5 * 60_000

/** Rounds an instant to the nearest five minutes. */
export const roundToFive = (ms: number): number =>
	Math.round(ms / FIVE_MINUTES) * FIVE_MINUTES

const formats = new Map<string, Intl.DateTimeFormat>()

/** A cached `Intl.DateTimeFormat`; an unknown time zone falls back to the device's. */
function zoned(
	locale: string,
	timeZone: string,
	options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
	const key = `${locale}|${timeZone}|${JSON.stringify(options)}`
	let format = formats.get(key)
	if (format === undefined) {
		try {
			format = new Intl.DateTimeFormat(locale, { ...options, timeZone })
		} catch {
			format = new Intl.DateTimeFormat(locale, options)
		}
		formats.set(key, format)
	}
	return format
}

/** "21:35" / "9:35 PM" in the place's time zone, to five minutes. */
export const formatClock = (
	ms: number,
	timeZone: string,
	locale: string,
): string =>
	zoned(locale, timeZone, { hour: "numeric", minute: "2-digit" }).format(
		new Date(roundToFive(ms)),
	)

/** "Friday 25 September" / "Freitag, 25. September" in the place's time zone. */
export const formatNightDate = (
	ms: number,
	timeZone: string,
	locale: string,
): string =>
	zoned(locale, timeZone, {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(new Date(ms))

/** "Sat 26 Sep" in the place's time zone. */
export const formatShortDate = (
	ms: number,
	timeZone: string,
	locale: string,
): string =>
	Number.isFinite(ms)
		? zoned(locale, timeZone, {
				weekday: "short",
				day: "numeric",
				month: "short",
			}).format(new Date(ms))
		: "—"

/** "low in the south-west" / "tief im Südwesten". */
export const whereText = (position: SkyPosition, i18n: I18n): string =>
	i18n.t("solarSystem.sky.where", {
		height: heightOf(position.altitude),
		dir: compassOf(position.azimuth),
	})

/** The sunset line under the title. */
export function sunText(sky: SkyTonight, timeZone: string, i18n: I18n): string {
	if (sky.kind === "midnightSun")
		return i18n.t("solarSystem.sky.night.midnightSun")
	if (sky.kind === "polarNight")
		return i18n.t("solarSystem.sky.night.polarNight")
	const clock = (ms: number | null) =>
		ms === null ? "—" : formatClock(ms, timeZone, i18n.formatLocale)
	return sky.dusk === null
		? i18n.t("solarSystem.sky.night.sunLight", {
				sunset: clock(sky.sunset),
				sunrise: clock(sky.sunrise),
			})
		: i18n.t("solarSystem.sky.night.sun", {
				sunset: clock(sky.sunset),
				dusk: clock(sky.dusk),
				sunrise: clock(sky.sunrise),
			})
}

/** "From about 21:35 until dawn". */
export function whenText(
	sighting: Sighting,
	timeZone: string,
	i18n: I18n,
): string {
	const clock = (ms: number) => formatClock(ms, timeZone, i18n.formatLocale)
	if (sighting.fromDusk && sighting.untilDawn)
		return i18n.t("solarSystem.sky.when.allNight")
	if (sighting.fromDusk)
		return i18n.t("solarSystem.sky.when.fromDusk", {
			until: clock(sighting.until),
		})
	if (sighting.untilDawn)
		return i18n.t("solarSystem.sky.when.untilDawn", {
			from: clock(sighting.from),
		})
	return i18n.t("solarSystem.sky.when.between", {
		from: clock(sighting.from),
		until: clock(sighting.until),
	})
}

/** The lines telling where to look, in the order they are shown. */
export function whereLines(
	sighting: Sighting,
	timeZone: string,
	i18n: I18n,
): string[] {
	const clock = (ms: number) => formatClock(ms, timeZone, i18n.formatLocale)
	const { first, best } = sighting
	const lines = [
		i18n.t("solarSystem.sky.first", {
			at: sighting.fromDusk ? "dusk" : "time",
			time: clock(first.ms),
			where: whereText(first, i18n),
		}),
		i18n.t("solarSystem.sky.fists", {
			fists: fistsOf(first.altitude),
			altitude: Math.round(first.altitude),
			azimuth: Math.round(first.azimuth),
		}),
	]
	// the highest point, when it is worth a second look (not for the youngest readers)
	if (
		i18n.readingLevel !== "simple" &&
		best.altitude - first.altitude >= 15 &&
		best.ms - first.ms >= 30 * 60_000
	) {
		lines.push(
			i18n.t("solarSystem.sky.best", {
				time: clock(best.ms),
				where: whereText(best, i18n),
			}),
		)
	}
	return lines
}

/** What it looks like: brightness, colour, what to bring. */
export const lookText = (sighting: Sighting, i18n: I18n): string =>
	i18n.t(`solarSystem.sky.look.${sighting.id}`, {
		brightness: sighting.brightness,
	})

/** Why a body is not in the list tonight. */
export function hiddenText(sighting: Sighting, name: Name, i18n: I18n): string {
	return i18n.t(
		`solarSystem.sky.hiddenReason.${sighting.reason ?? "daytime"}`,
		{ body: name(sighting.id), side: sighting.side },
	)
}

/** The geometry that makes a body visible tonight, for "Why can I see it?". */
export type WhyCase = "far" | "evening" | "morning" | "near" | "moon"

export function whyCase(sighting: Sighting): WhyCase {
	if (sighting.id === "moon") return "moon"
	if (sighting.elongation >= 135) return "far"
	if (sighting.elongation < 45) return "near"
	return sighting.side
}

export function whyText(
	sighting: Sighting,
	moonFraction: number,
	name: Name,
	i18n: I18n,
): string {
	return i18n.t(`solarSystem.sky.why.${whyCase(sighting)}`, {
		body: name(sighting.id),
		angle: Math.round(sighting.elongation),
		side: sighting.side,
		fraction: moonFraction,
	})
}
