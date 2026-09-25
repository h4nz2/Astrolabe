import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { spacecraft } from "@/data/spacecraft"
import { SPACECRAFT_EVENT_KINDS } from "@/data/spacecraftSchema"
import { LOCALES, READING_LEVELS, createI18n } from "@/i18n"
import { bodyName } from "@/i18n/bodies"

import { eventLabel, formatSignalTime } from "./text"

describe.each(LOCALES)("milestones in %s", (locale) => {
	it("reads every milestone as a sentence, with its target named", () => {
		for (const readingLevel of READING_LEVELS) {
			const i18n = createI18n({ locale, readingLevel })
			const name = (id: string) => bodyName(id, i18n.chain)
			for (const kind of SPACECRAFT_EVENT_KINDS) {
				expect(eventLabel({ kind }, i18n, name)).not.toMatch(
					/[{}]|spacecraft\./,
				)
			}
			for (const craft of spacecraft) {
				for (const event of craft.events) {
					const label = eventLabel(event, i18n, name)
					expect(label, `${craft.id} ${event.kind}`).not.toMatch(
						/[{}]|spacecraft\./,
					)
					if (event.target !== undefined && event.target !== "l2") {
						const target = bodies.some((b) => b.id === event.target)
							? name(event.target)
							: i18n.t(`solarSystem.spacecraft.target.${event.target}` as never)
						expect(label, `${craft.id} ${event.kind}`).toContain(target)
					}
				}
			}
		}
	})
})

describe("formatSignalTime", () => {
	const en = createI18n({ locale: "en" })
	const de = createI18n({ locale: "de" })
	it("uses seconds, minutes or hours and minutes", () => {
		expect(formatSignalTime(5.1, en)).toBe("5 seconds")
		expect(formatSignalTime(499, en)).toBe("8 minutes")
		expect(formatSignalTime(23 * 3600 + 34 * 60 + 10, en)).toBe(
			"23 hours 34 minutes",
		)
		expect(formatSignalTime(23 * 3600 + 34 * 60, de)).toBe(
			"23 Stunden 34 Minuten",
		)
		expect(formatSignalTime(3600, en)).toBe("60 minutes")
	})
})
