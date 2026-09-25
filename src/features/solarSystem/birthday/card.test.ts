import { describe, expect, it } from "vitest"

import { createI18n } from "@/i18n"
import { bodyName } from "@/i18n/bodies"

import { WEIGHT_WORLD_IDS, birthdayFacts } from "./birthday"
import { WORLD_COLORS, cardText } from "./card"

const facts = birthdayFacts("2014-09-25", new Date("2026-09-25T12:00:00"))

describe("the birthday picture", () => {
	it("tells the ages in the active language, never the birth date", () => {
		const i18n = createI18n({ locale: "de" })
		const text = cardText(
			facts,
			i18n,
			(id) => bodyName(id, i18n.chain),
			(day) => `<${day}>`,
			"11,3 Milliarden",
		)
		expect(text.rows.map((row) => row.name)).toContain("Mars")
		expect(text.rows.find((row) => row.id === "mars")?.age).toBe("6 Jahre alt")
		expect(text.rows.find((row) => row.id === "neptune")?.age).toBe(
			"noch nicht 1 Jahr alt",
		)
		expect(text.date).toBe("Am <2026-09-25>")
		expect(text.distance).toContain("11,3 Milliarden km")
		expect(text.fileName).toBe("mein-alter-auf-den-planeten.png")
		expect(JSON.stringify(text)).not.toContain("2014")
	})

	it("has a colour for every world it names", () => {
		for (const id of WEIGHT_WORLD_IDS) expect(WORLD_COLORS[id]).toBeDefined()
	})
})
