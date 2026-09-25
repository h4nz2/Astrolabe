/**
 * "Your birthday in space" (issue #26): the arithmetic, pure and unit-tested.
 * Everything is derived from the body data (`src/data/bodies.json`): a year is
 * a body's sidereal orbital period, a day its solar day (sunrise to sunrise,
 * from the sidereal rotation and the orbit), the pull its surface gravity.
 *
 * A birth date is a calendar day ("YYYY-MM-DD") without a time zone. For the
 * orbital arithmetic it stands for its noon, UTC: the same instant "show the
 * planets on my birthday" travels to (`arrivalJD`, #14). Ages on Earth are
 * counted like everyone counts them, by calendar birthdays.
 */
import { bodyById, getBody, planets, type Body } from "@/data"
import { dateToJD } from "@/sim"

import { arrivalJD, dayOf, type Day } from "../ui/timeTravel"

/** Newton's gravitational constant, m³ kg⁻¹ s⁻². */
export const GRAVITATIONAL_CONSTANT = 6.6743e-11

/** The earliest birth date the calendar offers. */
export const FIRST_BIRTH_DAY: Day = "1900-01-01"

/** The seven large moons: round worlds, each bigger than Pluto. */
export const LARGE_MOON_IDS: readonly string[] = [
	"moon",
	"io",
	"europa",
	"ganymede",
	"callisto",
	"titan",
	"triton",
]

/** Ages and days are told for the planets: the worlds with a year of their own around the Sun. */
export const AGE_WORLD_IDS: readonly string[] = planets.map((body) => body.id)

/**
 * Weights are told for the Sun, the planets and the large moons (each after
 * its planet). Small moons would only add a list of near-zeros.
 */
export const WEIGHT_WORLD_IDS: readonly string[] = [
	"sun",
	...planets.flatMap((planet) => [
		planet.id,
		...LARGE_MOON_IDS.filter((id) => bodyById.get(id)?.parentId === planet.id),
	]),
]

/** Bodies with no ground to stand on: a weight there is the pull at the cloud tops. */
export const hasNoSurface = (body: Body): boolean =>
	body.kind === "star" ||
	body.id === "jupiter" ||
	body.id === "saturn" ||
	body.id === "uranus" ||
	body.id === "neptune"

// ---------------------------------------------------------------- calendar

/** A local calendar day of a Date ("today" is the viewer's own day). */
export const localDay = (date: Date): Day =>
	`${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

const parts = (day: Day) => {
	const [year, month, date] = day.slice(0, 10).split("-").map(Number)
	return { year, month, date }
}

const isLeapYear = (year: number): boolean =>
	(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** The anniversary of `birth` in `year`; 29 February falls on the 28th in other years. */
export function anniversary(birth: Day, year: number): Day {
	const { month, date } = parts(birth)
	const day = month === 2 && date === 29 && !isLeapYear(year) ? 28 : date
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Age in whole calendar years on `today` (both calendar days); 0 before the first birthday. */
export function calendarAge(birth: Day, today: Day): number {
	const years = parts(today).year - parts(birth).year
	return anniversary(birth, parts(today).year) <= today
		? years
		: Math.max(0, years - 1)
}

/** The next calendar birthday strictly after `today`. */
export function nextCalendarBirthday(birth: Day, today: Day): Day {
	const thisYear = anniversary(birth, parts(today).year)
	return thisYear > today ? thisYear : anniversary(birth, parts(today).year + 1)
}

// ---------------------------------------------------------------- physics

/** A body's year in Earth days: its sidereal orbital period (the Sun has none). */
export const yearDays = (body: Body): number | null =>
	body.orbit?.periodDays ?? null

/**
 * A body's solar day in Earth days: sunrise to sunrise. From the sidereal
 * rotation and the orbit, 1 / solar = 1 / sidereal - 1 / year (a negative,
 * retrograde rotation makes the day shorter than the spin, as on Venus).
 * Null for bodies without a known spin or orbit.
 */
export function solarDayDays(body: Body): number | null {
	const spinHours = body.rotation.periodHours
	const year = yearDays(body)
	if (spinHours === null || spinHours === 0 || year === null) return null
	const perDay = 24 / spinHours - 1 / year
	return perDay === 0 ? null : Math.abs(1 / perDay)
}

/**
 * Surface gravity in m/s²: the curated value the dictionary shows (at the
 * equator, at the 1 bar level for the giants) when the data has one, else
 * G M / R² from mass and radius.
 */
export function surfaceGravity(body: Body): number | null {
	const curated = body.info.gravity
	if (typeof curated === "number" && Number.isFinite(curated) && curated > 0) {
		return curated
	}
	if (body.massKg === null || body.radiusKm <= 0) return null
	const radiusM = body.radiusKm * 1000
	return (GRAVITATIONAL_CONSTANT * body.massKg) / (radiusM * radiusM)
}

/** What a scale would show on `body` for someone who weighs `earthKg` on Earth. */
export function weightOn(body: Body, earthKg: number): number | null {
	const here = surfaceGravity(body)
	const earth = surfaceGravity(getBody("earth"))
	if (here === null || earth === null) return null
	return (earthKg * here) / earth
}

/** An orbit's length in km (Ramanujan's ellipse perimeter; exact to ppm at planetary eccentricities). */
export function orbitLengthKm(body: Body): number | null {
	if (body.orbit === null) return null
	const a = body.orbit.semiMajorAxisKm
	const b = a * Math.sqrt(1 - body.orbit.eccentricity ** 2)
	return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
}

// ---------------------------------------------------------------- results

/** One planet's view of a life. */
export interface WorldAge {
	id: string
	/** Birthdays had there (whole years). */
	age: number
	/** Years there, with the fraction of the current one. */
	exactAge: number
	/** Length of the year there, in Earth days. */
	yearDays: number
	/** The next birthday there: its instant (JD) and calendar day (UTC). */
	nextJD: number
	nextDay: Day
	/** The Earth age (calendar years) on that day. */
	earthAgeThen: number
	/** A birthday there falls on `today`. */
	birthdayToday: boolean
	/** Local days (sunrise to sunrise) lived there, and how long one lasts in Earth days. */
	daysLived: number | null
	solarDayDays: number | null
}

export interface BirthdayFacts {
	birthDay: Day
	today: Day
	/** The instant the birthday stands for (noon UTC) and "now". */
	birthJD: number
	nowJD: number
	/** Earth days since the birth. */
	daysAlive: number
	worlds: WorldAge[]
	/** How far Earth has carried you around the Sun, km, and at what mean speed (km/s). */
	distanceKm: number
	orbitSpeedKmS: number
	/** That distance in trips to the Moon and back. */
	moonTrips: number
}

/**
 * Everything the birthday panel shows, for a birth day and the present
 * (`now` is injected so tests and the panel agree on one instant).
 */
export function birthdayFacts(birthDay: Day, now: Date): BirthdayFacts {
	const today = localDay(now)
	const birthJD = arrivalJD(birthDay)
	const nowJD = dateToJD(now)
	const daysAlive = Math.max(0, nowJD - birthJD)
	const earthAge = calendarAge(birthDay, today)

	const worlds = AGE_WORLD_IDS.map((id): WorldAge => {
		const body = getBody(id)
		const solarDay = solarDayDays(body)
		const daysLived =
			solarDay === null ? null : Math.floor(daysAlive / solarDay)
		if (id === "earth") {
			// on Earth a birthday is a date in the calendar, not an orbit count:
			// the calendar year is 20 minutes shorter than the sidereal one
			const nextDay = nextCalendarBirthday(birthDay, today)
			return {
				id,
				age: earthAge,
				exactAge: daysAlive / 365.2425,
				yearDays: yearDays(body) ?? 365.2425,
				nextJD: arrivalJD(nextDay),
				nextDay,
				earthAgeThen: earthAge + 1,
				birthdayToday:
					today !== birthDay &&
					anniversary(birthDay, parts(today).year) === today,
				daysLived,
				solarDayDays: solarDay,
			}
		}
		const year = yearDays(body) ?? Number.POSITIVE_INFINITY
		const exactAge = daysAlive / year
		const age = Math.floor(exactAge)
		const nextJD = birthJD + (age + 1) * year
		const nextDay = dayOf(nextJD)
		return {
			id,
			age,
			exactAge,
			yearDays: year,
			nextJD,
			nextDay,
			earthAgeThen: calendarAge(birthDay, nextDay),
			birthdayToday: age > 0 && dayOf(birthJD + age * year) === today,
			daysLived,
			solarDayDays: solarDay,
		}
	})

	const earth = getBody("earth")
	const orbitKm = orbitLengthKm(earth) ?? 0
	const earthYear = yearDays(earth) ?? 365.256
	const distanceKm = (daysAlive / earthYear) * orbitKm
	const moonKm = getBody("moon").orbit?.semiMajorAxisKm ?? 384400
	return {
		birthDay,
		today,
		birthJD,
		nowJD,
		daysAlive,
		worlds,
		distanceKm,
		orbitSpeedKmS: orbitKm / (earthYear * 86400),
		moonTrips: distanceKm / (2 * moonKm),
	}
}

/** The calendar opens on the first of January ten years back: most visitors are children. */
export function calendarStart(now: Date): Day {
	return `${String(now.getFullYear() - 10).padStart(4, "0")}-01-01`
}

// ---------------------------------------------------------------- formatting

const bigFormats = new Map<string, Intl.NumberFormat>()

/**
 * A big number in words, three significant digits: "11.3 billion" /
 * "11,3 Milliarden" (children read words better than nine zeros); below a
 * million the plain grouped number.
 */
export function formatBigNumber(value: number, locale: string): string {
	let format = bigFormats.get(locale)
	if (format === undefined) {
		format = new Intl.NumberFormat(locale, {
			notation: "compact",
			compactDisplay: "long",
			maximumSignificantDigits: 3,
		})
		bigFormats.set(locale, format)
	}
	return Math.abs(value) < 1e6
		? new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
		: format.format(value)
}

/** A weight for the list: one decimal below 100 kg, whole kilograms above. */
export function formatKg(kg: number, locale: string): string {
	return new Intl.NumberFormat(locale, {
		maximumFractionDigits: kg < 100 ? 1 : 0,
	}).format(kg)
}
