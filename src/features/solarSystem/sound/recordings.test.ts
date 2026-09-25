import { existsSync, readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { bodyById } from "@/data"
import { LOCALES, READING_LEVELS, createI18n } from "@/i18n"

import { RECORDINGS, recordingForBody } from "./recordings"

const publicDir = resolve(__dirname, "../../../../public")

describe("the recordings", () => {
	it("carry real data for at least three bodies, one each", () => {
		const bodiesWith = new Set(RECORDINGS.map((recording) => recording.bodyId))
		expect(bodiesWith.size).toBeGreaterThanOrEqual(3)
		expect(bodiesWith.size).toBe(RECORDINGS.length)
		for (const recording of RECORDINGS) {
			expect(bodyById.has(recording.bodyId)).toBe(true)
			expect(recordingForBody(recording.bodyId)).toBe(recording)
		}
		expect(recordingForBody("mars")).toBeUndefined()
	})

	it("ship as small MP3 files that exist", () => {
		for (const recording of RECORDINGS) {
			const path = resolve(publicDir, recording.file)
			expect(existsSync(path), recording.file).toBe(true)
			expect(statSync(path).size).toBeLessThan(150_000)
			// an MP3 frame sync or an ID3 tag
			const head = readFileSync(path).subarray(0, 3)
			expect(
				head.toString("latin1") === "ID3" ||
					(head[0] === 0xff && (head[1] & 0xe0) === 0xe0),
			).toBe(true)
		}
	})

	it("record their source and a licence that allows reuse with credit", () => {
		const credits = readFileSync(
			resolve(publicDir, "assets/sounds/CREDITS.md"),
			"utf8",
		)
		for (const recording of RECORDINGS) {
			expect(recording.sourceUrl).toMatch(/^https:\/\//)
			expect(recording.licence).toMatch(/^CC BY [34]\.0$/)
			expect(credits).toContain(recording.file.replace("assets/sounds/", ""))
			expect(credits).toContain(recording.sourceUrl)
		}
	})

	it.each(
		LOCALES.flatMap((locale) =>
			READING_LEVELS.map((readingLevel) => ({ locale, readingLevel })),
		),
	)(
		"say what they are, honestly, in $locale at the $readingLevel level",
		(options) => {
			const { t } = createI18n(options)
			for (const recording of RECORDINGS) {
				const key = `solarSystem.sound.recording.${recording.id}` as const
				const title = t(`${key}.title`)
				const what = t(`${key}.what`)
				expect(title).not.toContain("solarSystem")
				expect(what.length).toBeGreaterThan(60)
			}
			expect(t("solarSystem.sound.honest").length).toBeGreaterThan(60)
		},
	)
})
