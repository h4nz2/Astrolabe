/**
 * Sky events as staged scenes (#41): every event plays as a tour (#28) whose
 * first stop sets time, scale and layers, and whose view from Earth stands
 * the camera where the event is really seen; and every event has its words
 * in every locale at every reading level.
 */
import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { SKY_EVENTS, eventOfTourId, skyEventById } from "@/data/skyEvents"
import { TourStop } from "@/data/tours"
import { LOCALES, READING_LEVELS, createI18n } from "@/i18n"
import { angleBetween, buildIndex, computePositions } from "@/sim"

import { stopStep, timeJD } from "../tours/plan"
import { eventJD, eventRealJD } from "./instant"
import { shownOffset } from "./EventCard"
import { EVENT_SCALE, eventTour } from "./staging"
import { EventTextFile, eventText, eventWords } from "./text"

const index = buildIndex(bodies)

describe("every event as a tour", () => {
	it.each(SKY_EVENTS.map((event) => [event.id, event] as const))(
		"%s: sets time, true scale and layers first, and is a valid tour",
		(_, event) => {
			const tour = eventTour(event)
			// every stop follows the tour format (a tour file needs two; an event may have one)
			for (const stop of tour.stops) {
				expect(TourStop.safeParse(stop).error?.issues ?? []).toEqual([])
			}
			expect(eventOfTourId(tour.id)?.id).toBe(event.id)
			expect(tour.returnOnExit).toBe(true)
			const [space] = tour.stops
			expect(space.id).toBe("space")
			expect(space.time).toEqual({ event: event.id })
			expect(timeJD(space.time!)).toBe(eventJD(event))
			expect(space.scale).toBe(EVENT_SCALE)
			expect(space.speed).toBe("paused")
		},
	)

	it("stands the camera on the Earth where the event is seen: the Moon covers the Sun in 2024", () => {
		const event = skyEventById.get("solar2024")!
		const tour = eventTour(event)
		const jd = eventJD(event)
		const step = stopStep(tour, 1, jd)
		expect(step.lensDeg).toBe(2)
		expect(step.eye?.anchorId).toBe("earth")
		const positions = computePositions(bodies, jd, undefined, index)
		const at = (id: string) => {
			const i = index.get(id)! * 3
			return [positions[i], positions[i + 1], positions[i + 2]]
		}
		const earth = at("earth")
		const eye = step.eye!.offsetKm.map((v, k) => v + earth[k])
		const sun = at("sun").map((v, k) => v - eye[k])
		const moon = at("moon").map((v, k) => v - eye[k])
		const sunR = Math.asin(695_700 / Math.hypot(...sun))
		const moonR = Math.asin(1737.4 / Math.hypot(...moon))
		const apart = angleBetween(
			sun[0],
			sun[1],
			sun[2],
			moon[0],
			moon[1],
			moon[2],
		)
		// total: the Moon's disc covers the Sun's entirely
		expect(apart + sunR).toBeLessThan(moonR)
	})

	it("gives a view from Earth to every sky event and to the discoveries", () => {
		for (const event of SKY_EVENTS) {
			const views = eventTour(event).stops.map((stop) => stop.id)
			const expected =
				event.check.kind === "moment" && event.earth === undefined
					? ["space"]
					: ["space", "earth"]
			expect(views, event.id).toEqual(expected)
		}
	})

	it("says honestly how far the scene's instant is from the real one", () => {
		const i18n = createI18n({ locale: "en" })
		const event = skyEventById.get("solar2024")!
		const offset = shownOffset(event, i18n)
		const minutes = (eventJD(event) - eventRealJD(event)) * 1440
		expect(offset?.direction).toBe(minutes < 0 ? "early" : "late")
		expect(offset?.amount).toMatch(/hour/)
		expect(shownOffset(skyEventById.get("moonLanding")!, i18n)).toBeNull()
	})
})

describe("the events' words", () => {
	it.each(LOCALES.map((locale) => [locale]))(
		"%s: every event, every field, every reading level",
		(locale) => {
			const file = eventText.get(locale)
			expect(file, locale).toBeDefined()
			const parsed = EventTextFile.safeParse(file)
			expect(parsed.error?.issues ?? []).toEqual([])
			expect(Object.keys(file!).sort()).toEqual(
				SKY_EVENTS.map((event) => event.id).sort(),
			)
			for (const event of SKY_EVENTS) {
				const look = file![event.id].look
				expect(
					typeof look === "object" ? Object.keys(look).sort() : [],
					`${locale} ${event.id}`,
				).toEqual([...READING_LEVELS].sort())
				for (const readingLevel of READING_LEVELS) {
					const i18n = createI18n({ locale, readingLevel })
					const words = eventWords(event.id, i18n)
					expect(words.title).not.toBe(event.id)
					expect(words.where.length).toBeGreaterThan(0)
					expect(words.look.length).toBeGreaterThan(10)
				}
			}
		},
	)

	it("names every group and view hint in every locale", () => {
		for (const locale of LOCALES) {
			const { t } = createI18n({ locale })
			for (const event of SKY_EVENTS) {
				expect(t(`solarSystem.events.groups.${event.group}`)).not.toContain(
					"solarSystem",
				)
				for (const view of ["space", "earth"] as const) {
					expect(
						t(`solarSystem.events.hint.${view}.${event.group}`),
					).not.toContain("solarSystem")
				}
			}
		}
	})
})
