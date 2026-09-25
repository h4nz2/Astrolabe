import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { spacecraft } from "@/data/spacecraft"
import { SPACECRAFT_EVENT_KINDS } from "@/data/spacecraftSchema"
import { LOCALES, READING_LEVELS, createI18n } from "@/i18n"
import { bodyName } from "@/i18n/bodies"

import { eventLabel } from "./text"

/** Locales whose target names change with the case (Czech genitive). */
const DECLINING = new Set(["cs"])

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
					// languages that decline names ("kolem Europy") are checked by eye
					if (
						!DECLINING.has(locale) &&
						event.target !== undefined &&
						event.target !== "l2"
					) {
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
