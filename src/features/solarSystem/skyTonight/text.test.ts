import { describe, expect, it } from "vitest"

import {
	READING_LEVELS,
	createI18n,
	type Locale,
	type ReadingLevel,
} from "@/i18n"
import { bodyName } from "@/i18n/bodies"

import type { Sighting, SkyTonight } from "./sky"
import {
	formatClock,
	hiddenText,
	lookText,
	roundToFive,
	sunText,
	whenText,
	whereLines,
	whereText,
	whyCase,
	whyText,
} from "./text"

/** Intl puts a narrow no-break space before AM/PM: compare with plain spaces. */
const plain = (text: string) => text.replace(/\s/g, " ")

const setup = (
	locale: Locale = "en",
	readingLevel: ReadingLevel = "standard",
) => {
	const i18n = createI18n({ locale, readingLevel })
	return { i18n, name: (id: string) => bodyName(id, i18n.chain) }
}

const at = (iso: string) => Date.parse(iso)

/** Jupiter rising in the east at 21:08 CEST, highest in the south at 02:52 CEST. */
const jupiter: Sighting = {
	id: "jupiter",
	visible: true,
	from: at("2026-09-25T19:08:00Z"),
	until: at("2026-09-26T04:40:00Z"),
	fromDusk: false,
	untilDawn: true,
	first: { ms: at("2026-09-25T19:08:00Z"), altitude: 5.2, azimuth: 118 },
	best: { ms: at("2026-09-26T00:52:00Z"), altitude: 47, azimuth: 181 },
	magnitude: -2.4,
	brightness: "veryBright",
	aid: "eyes",
	elongation: 150,
	side: "evening",
	reason: null,
}

const night: SkyTonight = {
	kind: "night",
	start: at("2026-09-25T17:18:00Z"),
	end: at("2026-09-26T05:18:00Z"),
	sunset: at("2026-09-25T17:18:00Z"),
	sunrise: at("2026-09-26T05:18:00Z"),
	dusk: at("2026-09-25T17:48:00Z"),
	dawn: at("2026-09-26T04:47:00Z"),
	sightings: [jupiter],
	moon: {
		phase: { id: "full", fraction: 0.99, phaseAngleDeg: 10, waxing: true },
		nextFull: at("2026-09-26T16:49:00Z"),
		nextNew: at("2026-10-10T15:50:00Z"),
	},
}

const ZONE = "Europe/Zurich"

describe("times", () => {
	it("round to five minutes in the place's time zone and the locale's clock", () => {
		expect(roundToFive(at("2026-09-25T19:08:00Z"))).toBe(
			at("2026-09-25T19:10:00Z"),
		)
		expect(formatClock(jupiter.from, ZONE, "de")).toBe("21:10")
		expect(formatClock(jupiter.from, ZONE, "en-US")).toMatch(/^9:10\sPM$/)
		expect(formatClock(jupiter.from, "Australia/Sydney", "en-GB")).toBe("5:10")
	})

	it("fall back to the device's zone for a zone the browser does not know", () => {
		expect(formatClock(jupiter.from, "Mars/Olympus_Mons", "de")).toMatch(
			/^\d{1,2}:\d{2}$/,
		)
	})
})

describe("sentences in English", () => {
	it("say when and where, as someone in a garden needs it", () => {
		const { i18n } = setup()
		expect(plain(whenText(jupiter, ZONE, i18n))).toBe(
			"From about 9:10 PM until dawn",
		)
		expect(whereText(jupiter.first, i18n)).toBe("low in the south-east")
		expect(whereLines(jupiter, ZONE, i18n).map(plain)).toEqual([
			"At 9:10 PM: low in the south-east.",
			"About one fist above the horizon, holding your fist out at arm's length.",
			"Highest at about 2:50 AM: halfway up in the south.",
		])
		expect(lookText(jupiter, i18n)).toMatch(/^Brighter than any star/)
	})

	it("uses dusk and dawn instead of clock times where they fit", () => {
		const { i18n } = setup()
		const allNight = { ...jupiter, fromDusk: true }
		expect(whenText(allNight, ZONE, i18n)).toBe("All night long")
		expect(whereLines(allNight, ZONE, i18n)[0]).toBe(
			"When it gets dark: low in the south-east.",
		)
		expect(
			plain(
				whenText({ ...jupiter, fromDusk: true, untilDawn: false }, ZONE, i18n),
			),
		).toBe("From dusk until about 6:40 AM")
	})

	it("says nearly overhead without a direction", () => {
		const { i18n } = setup()
		expect(whereText({ ms: 0, altitude: 80, azimuth: 12 }, i18n)).toBe(
			"almost straight overhead",
		)
	})

	it("gives the sunset line and the polar cases", () => {
		const { i18n } = setup()
		expect(plain(sunText(night, ZONE, i18n))).toBe(
			"Sunset 7:20 PM · dark from 7:50 PM · sunrise 7:20 AM",
		)
		expect(sunText({ ...night, dusk: null }, ZONE, i18n)).toMatch(
			/never gets fully dark/,
		)
		expect(sunText({ ...night, kind: "midnightSun" }, ZONE, i18n)).toMatch(
			/midnight sun/,
		)
	})

	it("explains a hidden planet", () => {
		const { i18n, name } = setup()
		const venus: Sighting = {
			...jupiter,
			id: "venus",
			visible: false,
			reason: "twilight",
			side: "evening",
		}
		expect(hiddenText(venus, name, i18n)).toBe(
			"Venus sets soon after the Sun, while the sky is still bright.",
		)
		expect(hiddenText({ ...venus, reason: "sunGlare" }, name, i18n)).toMatch(
			/^Venus is too close to the Sun/,
		)
	})

	it("explains the geometry behind a sighting", () => {
		const { i18n, name } = setup()
		expect(whyCase(jupiter)).toBe("far")
		expect(whyText(jupiter, 0.99, name, i18n)).toMatch(
			/^Tonight Earth is between the Sun and Jupiter\./,
		)
		expect(whyCase({ ...jupiter, elongation: 90, side: "morning" })).toBe(
			"morning",
		)
		expect(whyCase({ ...jupiter, elongation: 30 })).toBe("near")
		expect(whyCase({ ...jupiter, id: "moon" })).toBe("moon")
		expect(
			whyText({ ...jupiter, id: "moon", elongation: 168 }, 0.99, name, i18n),
		).toMatch(/168° from the Sun in our sky, so we see 99% of its sunlit half/)
	})
})

describe("sentences in German", () => {
	it("say when and where with German directions and 24-hour times", () => {
		const { i18n } = setup("de")
		expect(whenText(jupiter, ZONE, i18n)).toBe(
			"Ab etwa 21:10 bis zur Morgendämmerung",
		)
		expect(whereLines(jupiter, ZONE, i18n)).toEqual([
			"Um 21:10: tief im Südosten.",
			"Etwa eine Faust über dem Horizont, wenn du die Faust mit ausgestrecktem Arm hältst.",
			"Am höchsten um etwa 2:50: auf halber Höhe im Süden.",
		])
	})
})

describe("every locale and reading level", () => {
	it("has every sentence, with no raw keys or placeholders left", () => {
		for (const locale of ["en", "de"] as const) {
			for (const level of READING_LEVELS) {
				const { i18n, name } = setup(locale, level)
				const texts = [
					whenText(jupiter, ZONE, i18n),
					...whereLines(jupiter, ZONE, i18n),
					lookText(jupiter, i18n),
					sunText(night, ZONE, i18n),
					whyText(jupiter, 0.5, name, i18n),
					...(["sunGlare", "twilight", "brightSky", "daytime"] as const).map(
						(reason) =>
							hiddenText({ ...jupiter, visible: false, reason }, name, i18n),
					),
					...(
						[
							"moon",
							"mercury",
							"venus",
							"mars",
							"saturn",
							"uranus",
							"neptune",
						] as const
					).map((id) => lookText({ ...jupiter, id }, i18n)),
				]
				for (const text of texts) {
					expect(text, `${locale}/${level}`).not.toMatch(/solarSystem\.|[{}]/)
					expect(text.length).toBeGreaterThan(3)
				}
			}
		}
	})

	it("shows the youngest readers one position only, the others the highest point too", () => {
		expect(whereLines(jupiter, ZONE, setup("en", "simple").i18n)).toHaveLength(
			2,
		)
		expect(whereLines(jupiter, ZONE, setup("en", "advanced").i18n)[1]).toBe(
			"Altitude 5°, azimuth 118° (a fist at arm's length is about 10°).",
		)
	})
})
