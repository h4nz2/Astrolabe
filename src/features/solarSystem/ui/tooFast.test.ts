import { describe, expect, it } from "vitest"

import { bodies, getBody } from "@/data"
import { createI18n } from "@/i18n"

import {
	DEFAULT_FPS,
	TOO_FAST_LAPS_PER_FRAME,
	bodiesInView,
	lapsPerSecond,
	tooFastToFollow,
} from "./tooFast"

const YEAR = 31557600
const ids = (list: { id: string }[]) => list.map((body) => body.id)

describe("lapsPerSecond", () => {
	it("counts laps per real second in either direction", () => {
		// Mercury laps the Sun about 4.15 times a year
		const mercury = getBody("mercury").orbit!.periodDays
		expect(lapsPerSecond(mercury, YEAR)).toBeCloseTo(4.15, 2)
		expect(lapsPerSecond(mercury, -YEAR)).toBeCloseTo(4.15, 2)
		expect(lapsPerSecond(365.25, 86400)).toBeCloseTo(1 / 365.25, 8)
	})
})

describe("bodiesInView", () => {
	it("is the planets in the overview", () => {
		expect(ids(bodiesInView(bodies, "sun", true))).toEqual([
			"mercury",
			"venus",
			"earth",
			"mars",
			"jupiter",
			"saturn",
			"uranus",
			"neptune",
		])
	})

	it("adds the focused family's moons while moons are shown", () => {
		const jupiter = ids(bodiesInView(bodies, "jupiter", true))
		expect(jupiter).toContain("io")
		expect(jupiter).not.toContain("titan")
		// a focused moon brings its siblings
		expect(ids(bodiesInView(bodies, "europa", true))).toContain("io")
		// hidden moons do not count, except the focus
		const hidden = ids(bodiesInView(bodies, "europa", false))
		expect(hidden).toContain("europa")
		expect(hidden).not.toContain("io")
	})
})

describe("tooFastToFollow", () => {
	const planets = bodiesInView(bodies, "sun", true)

	it("stays quiet up to a year per second at 60 fps", () => {
		expect(tooFastToFollow(planets, 1, 60)).toBeNull()
		expect(tooFastToFollow(planets, YEAR, 60)).toBeNull()
		expect(tooFastToFollow(planets, -YEAR, 60)).toBeNull()
	})

	it("names the fastest planet at ten years per second", () => {
		const fast = tooFastToFollow(planets, 10 * YEAR, 60)
		expect(fast).toMatchObject({ id: "mercury", parentId: "sun" })
		expect(fast!.lapsPerSecond).toBeCloseTo(41.5, 0)
	})

	it("depends on the frame rate the device reaches", () => {
		// Mercury at 1 year/s moves 25° a frame at 60 fps but 60° at 25 fps
		expect(tooFastToFollow(planets, YEAR, 24)?.id).toBe("mercury")
		expect(tooFastToFollow(planets, YEAR, 30)).toBeNull()
	})

	it("catches fast moons long before the planets", () => {
		const mars = bodiesInView(bodies, "mars", true)
		// Phobos laps Mars three times a day: 22 laps a second at a week per second
		const fast = tooFastToFollow(mars, 604800, 60)
		expect(fast).toMatchObject({ id: "phobos", parentId: "mars" })
		expect(tooFastToFollow(mars, 3600, 60)).toBeNull()
	})

	it("is quiet while paused and assumes 60 fps before measuring", () => {
		expect(tooFastToFollow(planets, 0, 60)).toBeNull()
		expect(tooFastToFollow(planets, 10 * YEAR, 0)).toEqual(
			tooFastToFollow(planets, 10 * YEAR, DEFAULT_FPS),
		)
		expect(TOO_FAST_LAPS_PER_FRAME).toBeCloseTo(1 / 6)
	})

	it("reads naturally in every language", () => {
		const values = {
			body: "Mercury",
			parent: "Sun",
			parentId: "sun",
			count: 42,
		}
		expect(
			createI18n({ locale: "en" }).t("solarSystem.time.tooFast", values),
		).toMatch(/^Mercury circles the Sun 42 times a second/)
		expect(
			createI18n({ locale: "de" }).t("solarSystem.time.tooFast", {
				...values,
				body: "Phobos",
				parent: "Mars",
				parentId: "mars",
			}),
		).toMatch(/^Phobos umrundet Mars 42 Mal pro Sekunde/)
	})
})
