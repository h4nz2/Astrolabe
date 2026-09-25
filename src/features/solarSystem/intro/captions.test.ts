import { describe, expect, it } from "vitest"

import { LOCALES, READING_LEVELS, createI18n } from "@/i18n"
import { bodyName } from "@/i18n/bodies"

import {
	EARTHS_TO_THE_MOON,
	INNER_PLANETS,
	introCaption,
	listOfNames,
} from "./captions"
import { INTRO_BEATS } from "./script"

const captions = (
	locale: (typeof LOCALES)[number],
	readingLevel = "standard",
) => {
	const i18n = createI18n({
		locale,
		readingLevel: readingLevel as (typeof READING_LEVELS)[number],
	})
	const name = (id: string) => bodyName(id, i18n.chain)
	return Object.fromEntries(
		INTRO_BEATS.map((beat) => [beat, introCaption(beat, i18n, name)]),
	)
}

describe("the opening's captions", () => {
	it("says 30 Earths fit between Earth and the Moon", () => {
		expect(EARTHS_TO_THE_MOON).toBe(30)
	})

	for (const locale of LOCALES) {
		for (const level of READING_LEVELS) {
			it(`has a title and a detail for every beat (${locale}, ${level})`, () => {
				for (const caption of Object.values(captions(locale, level))) {
					expect(caption.title.length).toBeGreaterThan(3)
					expect(caption.detail.length).toBeGreaterThan(3)
					// every argument was filled in, no key leaked through
					expect(caption.title + caption.detail).not.toMatch(
						/[{}]|solarSystem\./,
					)
					// short enough to read in a beat
					expect(caption.title.length).toBeLessThanOrEqual(50)
					expect(caption.detail.length).toBeLessThanOrEqual(160)
				}
			})
		}
	}

	it("reads naturally in English and German", () => {
		const en = captions("en")
		expect(en.earth.title).toBe("This is Earth.")
		expect(en.moon.detail).toBe("30 Earths would fit in the gap.")
		expect(en.inner.detail).toBe(
			"Mercury, Venus, Earth, and Mars, the four rocky worlds nearest the Sun.",
		)
		const de = captions("de")
		expect(de.earth.title).toBe("Das ist die Erde.")
		expect(de.inner.detail).toBe(
			"Merkur, Venus, Erde und Mars: die vier Gesteinswelten nahe der Sonne.",
		)
		expect(captions("de", "advanced").moon.detail).toBe(
			"384.000 km entfernt: 30 Erddurchmesser.",
		)
		expect(captions("en", "simple").system.title).toBe(
			"Everything, at its real size",
		)
	})

	it("lists names in the locale's own way", () => {
		const names = (id: string) => id.toUpperCase()
		expect(listOfNames(INNER_PLANETS, names, { locale: "de" })).toBe(
			"MERCURY, VENUS, EARTH und MARS",
		)
	})
})
