import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { RAD_TO_DEG, angleBetween, buildIndex, dateToJD } from "@/sim"
import { bodyPositionAt } from "@/sim/referenceFrame"

import { cityById } from "./places"
import {
	SKY_BODY_IDS,
	aidFor,
	brightnessOf,
	compassOf,
	fistsOf,
	heightOf,
	hiddenReason,
	moonPhaseAt,
	nightAround,
	skyPosition,
	skyTonight,
	sunLimit,
	type SkyPlace,
	type SkyTonight,
} from "./sky"

const place = (id: string): SkyPlace => {
	const city = cityById.get(id)
	if (city === undefined) throw new Error(id)
	return city
}
const at = (iso: string) => Date.parse(iso)
const HOUR = 3_600_000

const find = (sky: SkyTonight, id: string) => {
	const s = sky.sightings.find((sighting) => sighting.id === id)
	if (s === undefined) throw new Error(id)
	return s
}

// computed once: each night takes a few tens of milliseconds
const zurich = skyTonight(place("zurich"), at("2026-09-25T10:00:00Z"))
const sydney = skyTonight(place("sydney"), at("2026-09-25T02:00:00Z"))

describe("which night", () => {
	it("in the daytime, is the coming night: sunset to the next sunrise", () => {
		const night = nightAround(place("zurich"), at("2026-09-25T10:00:00Z"))
		expect(night.kind).toBe("night")
		// Zurich, 25 September 2026: sunset 19:18 CEST, sunrise 07:18 CEST (published tables)
		expect(Math.abs(night.start - at("2026-09-25T17:18:00Z"))).toBeLessThan(
			3 * 60_000,
		)
		expect(Math.abs(night.end - at("2026-09-26T05:18:00Z"))).toBeLessThan(
			4 * 60_000,
		)
	})

	it("after midnight, is still the night that began the evening before", () => {
		const evening = nightAround(place("zurich"), at("2026-09-25T10:00:00Z"))
		const small = nightAround(place("zurich"), at("2026-09-26T01:00:00Z"))
		expect(Math.abs(small.start - evening.start)).toBeLessThan(60_000)
		expect(Math.abs(small.end - evening.end)).toBeLessThan(60_000)
	})

	it("knows the midnight sun and the polar night", () => {
		const summer = skyTonight(place("tromso"), at("2026-06-21T20:00:00Z"))
		expect(summer.kind).toBe("midnightSun")
		expect(summer.sightings.every((s) => !s.visible)).toBe(true)
		const winter = skyTonight(place("tromso"), at("2026-12-21T12:00:00Z"))
		expect(winter.kind).toBe("polarNight")
		expect(winter.end - winter.start).toBe(24 * HOUR)
		// planets can be seen in the polar night
		expect(winter.sightings.some((s) => s.visible)).toBe(true)
	})

	it("gives civil dusk and dawn inside the night", () => {
		expect(zurich.dusk).not.toBeNull()
		expect(zurich.dawn).not.toBeNull()
		// about half an hour after sunset at 47 deg north in September
		const duskMinutes = ((zurich.dusk ?? 0) - zurich.start) / 60_000
		expect(duskMinutes).toBeGreaterThan(25)
		expect(duskMinutes).toBeLessThan(40)
		expect(zurich.dawn).toBeLessThan(zurich.end)
	})

	it("has no dark sky in a white night", () => {
		const sky = skyTonight(place("reykjavik"), at("2026-06-21T12:00:00Z"))
		expect(sky.kind).toBe("night")
		expect(sky.dusk).toBeNull()
	})
})

describe("tonight's sky, 25 September 2026", () => {
	it("lists every body once, the visible ones first", () => {
		expect(zurich.sightings.map((s) => s.id).sort()).toEqual(
			[...SKY_BODY_IDS].sort(),
		)
		const firstHidden = zurich.sightings.findIndex((s) => !s.visible)
		expect(zurich.sightings.slice(firstHidden).every((s) => !s.visible)).toBe(
			true,
		)
	})

	it("has the full moon of 26 September up all evening", () => {
		// full moon: 26 September 2026, 16:49 UTC
		expect(
			Math.abs(zurich.moon.nextFull - at("2026-09-26T16:49:00Z")),
		).toBeLessThan(10 * 60_000)
		expect(zurich.moon.phase.fraction).toBeGreaterThan(0.95)
		expect(zurich.moon.phase.waxing).toBe(true)
		const moon = find(zurich, "moon")
		expect(moon.visible).toBe(true)
		// a full moon rises at sunset in the east and is due south around midnight
		expect(moon.fromDusk).toBe(true)
		expect(compassOf(moon.first.azimuth)).toBe("e")
		expect(compassOf(moon.best.azimuth)).toBe("s")
	})

	it("has Saturn and Neptune near opposition: up all night, due south around 1:30 local time", () => {
		for (const id of ["saturn", "neptune"]) {
			const s = find(zurich, id)
			expect(s.visible).toBe(true)
			expect(s.elongation).toBeGreaterThan(165)
			expect(s.untilDawn).toBe(true)
			expect(Math.abs(s.best.azimuth - 180)).toBeLessThan(15)
			// local midnight in Zurich is 23:26 UTC (8.5 deg east); opposition a week later
			expect(Math.abs(s.best.ms - at("2026-09-25T23:40:00Z"))).toBeLessThan(
				1.5 * HOUR,
			)
		}
		expect(find(zurich, "saturn").aid).toBe("eyes")
		expect(find(zurich, "neptune").aid).toBe("telescope")
		expect(find(zurich, "uranus").aid).toBe("binoculars")
	})

	it("has Jupiter and Mars as morning planets, rising in the east after midnight", () => {
		for (const id of ["jupiter", "mars"]) {
			const s = find(zurich, id)
			expect(s.visible).toBe(true)
			expect(s.side).toBe("morning")
			expect(s.untilDawn).toBe(true)
			expect(s.fromDusk).toBe(false)
			expect(["ne", "e"]).toContain(compassOf(s.first.azimuth))
			expect(s.from).toBeGreaterThan(at("2026-09-25T23:00:00Z"))
		}
		expect(find(zurich, "jupiter").brightness).toBe("veryBright")
	})

	it("hides evening Venus from Zurich, but shows it from Sydney: the ecliptic stands steep there", () => {
		const north = find(zurich, "venus")
		expect(north.visible).toBe(false)
		expect(north.reason).toBe("twilight")
		expect(north.side).toBe("evening")
		const south = find(sydney, "venus")
		expect(south.visible).toBe(true)
		expect(south.fromDusk).toBe(true)
		expect(compassOf(south.first.azimuth)).toBe("w")
		expect(south.brightness).toBe("dazzling")
	})

	it("sees planets culminate in the north from the southern hemisphere", () => {
		const saturn = find(sydney, "saturn")
		const azimuth = ((saturn.best.azimuth + 180) % 360) - 180
		expect(Math.abs(azimuth)).toBeLessThan(15)
	})

	it("keeps every window inside the night and every sighting above the horizon", () => {
		for (const sky of [zurich, sydney]) {
			for (const s of sky.sightings.filter((x) => x.visible)) {
				expect(s.from).toBeGreaterThanOrEqual(sky.start)
				expect(s.until).toBeLessThanOrEqual(sky.end)
				expect(s.from).toBeLessThanOrEqual(s.until)
				expect(s.first.altitude).toBeGreaterThanOrEqual(0.5)
				expect(s.best.altitude).toBeGreaterThanOrEqual(s.first.altitude)
			}
		}
	})
})

describe("the horizontal conversion", () => {
	it("puts the noon Sun at 90 - latitude + declination, due south (north) of the observer", () => {
		// March equinox 2026 (20 March, 14:46 UTC): the Sun's declination is about -0.1 deg;
		// local noon at Greenwich is at about 12:07 UTC (the equation of time)
		const greenwich: SkyPlace = {
			latitude: 51.48,
			longitude: 0,
			timeZone: "Europe/London",
		}
		const noon = skyPosition("sun", greenwich, at("2026-03-20T12:07:00Z"))
		expect(noon.altitude).toBeCloseTo(90 - 51.48 - 0.1, 0)
		expect(Math.abs(noon.azimuth - 180)).toBeLessThan(1)
		const south: SkyPlace = {
			latitude: -33.87,
			longitude: 0,
			timeZone: "UTC",
		}
		const noonSouth = skyPosition("sun", south, at("2026-03-20T12:07:00Z"))
		expect(noonSouth.altitude).toBeCloseTo(90 - 33.87 + 0.1, 0)
		expect(Math.min(noonSouth.azimuth, 360 - noonSouth.azimuth)).toBeLessThan(1)
	})

	it("makes the equinox night about twelve hours long", () => {
		const sky = skyTonight(place("london"), at("2026-03-20T12:00:00Z"))
		expect((sky.end - sky.start) / HOUR).toBeGreaterThan(11.5)
		expect((sky.end - sky.start) / HOUR).toBeLessThan(12.5)
	})
})

describe("words for numbers", () => {
	it("names eight compass points", () => {
		expect(compassOf(0)).toBe("n")
		expect(compassOf(359)).toBe("n")
		expect(compassOf(44)).toBe("ne")
		expect(compassOf(90)).toBe("e")
		expect(compassOf(200)).toBe("s")
		expect(compassOf(250)).toBe("w")
		expect(compassOf(-45)).toBe("nw")
	})

	it("names heights and counts fists (10 deg at arm's length)", () => {
		expect(heightOf(8)).toBe("low")
		expect(heightOf(30)).toBe("mid")
		expect(heightOf(60)).toBe("high")
		expect(heightOf(80)).toBe("overhead")
		expect(fistsOf(3)).toBe(1)
		expect(fistsOf(24)).toBe(2)
		expect(fistsOf(46)).toBe(5)
	})

	it("says what to bring and how bright", () => {
		expect(aidFor(-4.5)).toBe("eyes")
		expect(aidFor(5.7)).toBe("binoculars")
		expect(aidFor(7.8)).toBe("telescope")
		expect(brightnessOf(-4.5)).toBe("dazzling")
		expect(brightnessOf(-2)).toBe("veryBright")
		expect(brightnessOf(0.2)).toBe("bright")
		expect(brightnessOf(1.2)).toBe("medium")
	})

	it("waits for a darker sky the fainter the body", () => {
		expect(sunLimit("venus", -4.5)).toBeGreaterThan(sunLimit("saturn", 0.5))
		expect(sunLimit("saturn", 0.5)).toBeGreaterThan(sunLimit("uranus", 5.7))
		expect(sunLimit("moon", -12)).toBeGreaterThan(-1)
	})

	it("gives a reason for every hidden body", () => {
		expect(hiddenReason(10, false)).toBe("sunGlare")
		expect(hiddenReason(35, false)).toBe("twilight")
		expect(hiddenReason(90, true)).toBe("brightSky")
		expect(hiddenReason(90, false)).toBe("daytime")
	})
})

describe("agreement with the simulation", () => {
	const index = buildIndex(bodies)
	const a = new Float64Array(3)
	const b = new Float64Array(3)
	const c = new Float64Array(3)
	// the angle Sun - Earth - body in the app's own model: what "Show me in space" draws
	const simElongation = (id: string, ms: number) => {
		const jd = dateToJD(new Date(ms))
		bodyPositionAt(bodies, index, index.get("earth") ?? 0, jd, a)
		bodyPositionAt(bodies, index, index.get("sun") ?? 0, jd, b)
		bodyPositionAt(bodies, index, index.get(id) ?? 0, jd, c)
		return (
			angleBetween(
				b[0] - a[0],
				b[1] - a[1],
				b[2] - a[2],
				c[0] - a[0],
				c[1] - a[1],
				c[2] - a[2],
			) * RAD_TO_DEG
		)
	}

	it("draws the same angle from the Sun as the list states (planets within 0.5 deg, the Moon within 3)", () => {
		for (const s of zurich.sightings) {
			const tolerance = s.id === "moon" ? 3 : 0.5
			expect(
				Math.abs(simElongation(s.id, s.first.ms) - s.elongation),
				s.id,
			).toBeLessThan(tolerance)
		}
	})

	it("describes the Moon's phase like the anchored frame does", () => {
		const phase = moonPhaseAt(at("2026-09-18T20:00:00Z"))
		// halfway between the new moon of 11 and the full moon of 26 September 2026
		expect(phase.id).toBe("firstQuarter")
		expect(phase.fraction).toBeGreaterThan(0.4)
		expect(phase.fraction).toBeLessThan(0.6)
	})
})
