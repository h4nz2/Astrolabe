import { beforeEach, describe, expect, it } from "vitest"

import { J2000_JD, dateToJD } from "@/sim"
import { useSimStore } from "@/store/sim"

import { skyEventById } from "@/data/skyEvents"

import { MOMENTS, MOMENT_IDS, momentJD } from "./moments"
import {
	FIRST_DAY,
	LAST_DAY,
	arrivalJD,
	calendarLabels,
	dayOf,
	dayStart,
	firstDayOfWeek,
	formatDayUTC,
	travelAndStop,
} from "./timeTravel"

describe("days", () => {
	it("maps a Julian Date to its UTC day and back to that day's noon", () => {
		expect(dayOf(J2000_JD)).toBe("2000-01-01")
		expect(dayOf(dateToJD(new Date("1969-07-20T23:59:00Z")))).toBe("1969-07-20")
		expect(arrivalJD("2000-01-01")).toBe(J2000_JD)
		expect(dayStart("1985-07-13 00:00:00").toISOString()).toBe(
			"1985-07-13T00:00:00.000Z",
		)
	})

	it("clamps days outside the picker's range", () => {
		expect(dayOf(dateToJD(new Date("0500-06-01T00:00:00Z")))).toBe(FIRST_DAY)
		expect(dayOf(dateToJD(new Date("3500-06-01T00:00:00Z")))).toBe(LAST_DAY)
		expect(dayOf(Number.NaN)).toBe(FIRST_DAY)
	})
})

describe("calendar labels", () => {
	it("formats the calendar with Intl in the active locale", () => {
		const en = calendarLabels("en")
		const de = calendarLabels("de")
		expect(en.monthLabelFormat("1969-07-01")).toBe("July 1969")
		expect(de.monthLabelFormat("1969-07-01")).toBe("Juli 1969")
		expect(de.monthsListFormat("1969-03-01")).toMatch(/^Mär/)
		expect(en.yearLabelFormat("1000-01-01")).toBe("1000")
		expect(en.decadeLabelFormat("1960-01-01", "1969-12-31")).toBe("1960 – 1969")
		expect(de.weekdayFormat("2026-09-21")).toBe("Mo")
		expect(en.getDayAriaLabel("1969-07-20")).toBe("Sunday, July 20, 1969")
		expect(formatDayUTC(new Date("1969-07-20T20:17:00Z"), "de")).toBe(
			"20.07.1969",
		)
	})

	it("starts the week where the locale does", () => {
		expect(firstDayOfWeek("de")).toBe(1)
		expect(firstDayOfWeek("en-US")).toBe(0)
	})
})

describe("moments", () => {
	it("are in order, valid, inside the picker's range and named in every locale", () => {
		const jds = MOMENTS.map(momentJD)
		for (const jd of jds) expect(Number.isFinite(jd)).toBe(true)
		expect([...jds].sort((a, b) => a - b)).toEqual(jds)
		expect(MOMENTS.map((moment) => moment.id)).toEqual([...MOMENT_IDS])
		expect(dayOf(jds[0])).not.toBe(FIRST_DAY)
		expect(dayOf(jds.at(-1)!)).not.toBe(LAST_DAY)
		// every moment is a sky event (#41), which carries its words
		for (const { id } of MOMENTS) expect(skyEventById.has(id), id).toBe(true)
		expect(momentJD(MOMENTS[4])).toBe(
			dateToJD(new Date("1969-07-20T20:17:00Z")),
		)
	})
})

describe("travelAndStop", () => {
	beforeEach(() => {
		useSimStore.getState().setPaused(false)
		useSimStore.getState().setSimTime(J2000_JD)
	})

	it("pauses and glides to the date", () => {
		const target = dateToJD(new Date("1969-07-20T20:17:00Z"))
		travelAndStop(target)
		const state = useSimStore.getState()
		expect(state.paused).toBe(true)
		expect(state.clock.glide).not.toBeNull()
		expect(state.clock.anchorJD).toBe(target)
		expect(state.clock.rate).toBe(0)
	})

	it("ignores non-finite dates", () => {
		travelAndStop(Number.NaN)
		expect(useSimStore.getState().paused).toBe(false)
		expect(useSimStore.getState().clock.glide).toBeNull()
	})
})
