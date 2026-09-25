/**
 * The words of the opening (#30): one short title and one line of detail per
 * beat, at every reading level, plus the hand-over hints. Every number comes
 * from the data and is formatted for the locale.
 */
import { bodyById } from "@/data"
import type { I18n } from "@/i18n"

import { MOON_DISTANCE_KM, type IntroBeat } from "./script"

export interface Caption {
	title: string
	detail: string
}

const EARTH_DIAMETER_KM = 2 * (bodyById.get("earth")?.radiusKm ?? 6371)

/** How many Earths fit between Earth and the Moon (centre to centre, rounded): 30. */
export const EARTHS_TO_THE_MOON = Math.round(
	MOON_DISTANCE_KM / EARTH_DIAMETER_KM,
)

/** The inner planets, Sun outwards. */
export const INNER_PLANETS = ["mercury", "venus", "earth", "mars"] as const

/** "Mercury, Venus, Earth, and Mars" / "Merkur, Venus, Erde und Mars". */
export function listOfNames(
	ids: readonly string[],
	name: (id: string) => string,
	i18n: Pick<I18n, "locale">,
): string {
	const names = ids.map(name)
	try {
		return new Intl.ListFormat(i18n.locale, {
			style: "long",
			type: "conjunction",
		}).format(names)
	} catch {
		return names.join(", ")
	}
}

/** The caption of `beat`. */
export function introCaption(
	beat: IntroBeat,
	i18n: I18n,
	name: (id: string) => string,
): Caption {
	const { t } = i18n
	switch (beat) {
		case "earth":
			return {
				title: t("solarSystem.intro.earth.title"),
				detail: t("solarSystem.intro.earth.detail"),
			}
		case "moon":
			return {
				title: t("solarSystem.intro.moon.title"),
				detail: t("solarSystem.intro.moon.detail", {
					earths: EARTHS_TO_THE_MOON,
					km: i18n.quantity(
						Math.round(MOON_DISTANCE_KM / 1000) * 1000,
						"kilometer",
					),
				}),
			}
		case "inner":
			return {
				title: t("solarSystem.intro.inner.title"),
				detail: t("solarSystem.intro.inner.detail", {
					planets: listOfNames(INNER_PLANETS, name, i18n),
				}),
			}
		case "system":
			return {
				title: t("solarSystem.intro.system.title"),
				detail: t("solarSystem.intro.system.detail"),
			}
		case "scale":
			return {
				title: t("solarSystem.intro.scale.title"),
				detail: t("solarSystem.intro.scale.detail"),
			}
	}
}
