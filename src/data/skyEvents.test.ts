/**
 * The contract of the sky events list (#41): every event is real (its
 * instant agrees with astronomy-engine, the tests' reference ephemeris) and
 * really happens in the app's own simulation, close enough to that instant
 * (`TOLERANCE_HOURS` in src/sim/skyEvents.ts). An event that fails here is
 * not listed.
 */
import * as Astronomy from "astronomy-engine"
import { describe, expect, it } from "vitest"

import { bodies, bodyById } from "@/data"
import { dateToJD } from "@/sim"
import {
	SEARCH_WINDOW_DAYS,
	SkyGeometry,
	TOLERANCE_HOURS,
	bestInstant,
	measureEvent,
	type EventCheck,
} from "@/sim/skyEvents"
import { spacecraftById } from "@/data/spacecraft"

import {
	EVENT_GROUPS,
	SKY_EVENTS,
	SkyEventSchema,
	eventsInGroup,
	skyEventsFile,
	type SkyEvent,
} from "./skyEvents"

const geometry = new SkyGeometry(bodies)
const AU_KM = 149_597_870.7

const astronomyBody = (id: string): Astronomy.Body => {
	const name = id.charAt(0).toUpperCase() + id.slice(1)
	const body = (Astronomy.Body as Record<string, Astronomy.Body>)[name]
	if (body === undefined) throw new Error(`no astronomy-engine body ${id}`)
	return body
}

const minutesBetween = (a: Date, b: Date) =>
	Math.abs(a.getTime() - b.getTime()) / 60_000

/** Golden-section minimum of `f` (ms timestamps) within [a, b], to a second. */
function minimize(f: (ms: number) => number, a: number, b: number): number {
	const g = (Math.sqrt(5) - 1) / 2
	let c = b - g * (b - a)
	let d = a + g * (b - a)
	let fc = f(c)
	let fd = f(d)
	while (b - a > 1000) {
		if (fc < fd) {
			b = d
			d = c
			fd = fc
			c = b - g * (b - a)
			fc = f(c)
		} else {
			a = c
			c = d
			fc = fd
			d = a + g * (b - a)
			fd = f(d)
		}
	}
	return (a + b) / 2
}

const HOUR = 3_600_000

/** The real event per astronomy-engine: the instant it peaks, compared with the listed one. */
function realPeak(event: SkyEvent): { peak: Date; ok: boolean; note: string } {
	const listed = new Date(event.utc)
	const before = new Date(listed.getTime() - 2 * 86_400_000)
	const check = event.check
	switch (check.kind) {
		case "solarEclipse": {
			const found = Astronomy.SearchGlobalSolarEclipse(before)
			return {
				peak: found.peak.date,
				ok: found.kind === check.type,
				note: found.kind,
			}
		}
		case "lunarEclipse": {
			const found = Astronomy.SearchLunarEclipse(before)
			return {
				peak: found.peak.date,
				ok: found.kind === check.type,
				note: found.kind,
			}
		}
		case "transit": {
			const found = Astronomy.SearchTransit(astronomyBody(check.body), before)
			return { peak: found.peak.date, ok: true, note: "transit" }
		}
		case "conjunction": {
			const [a, b] = check.bodies.map(astronomyBody)
			const separation = (ms: number) =>
				Astronomy.AngleBetween(
					Astronomy.GeoVector(a, new Date(ms), true),
					Astronomy.GeoVector(b, new Date(ms), true),
				)
			const peak = minimize(
				separation,
				listed.getTime() - 3 * 86_400_000,
				listed.getTime() + 3 * 86_400_000,
			)
			return {
				peak: new Date(peak),
				ok: separation(peak) <= check.maxDeg,
				note: `${separation(peak).toFixed(3)} deg`,
			}
		}
		case "gathering": {
			const lons = check.bodies.map(
				(id) =>
					Astronomy.Ecliptic(
						Astronomy.GeoVector(astronomyBody(id), listed, true),
					).elon,
			)
			const sorted = [...lons].sort((x, y) => x - y)
			let widest = 0
			sorted.forEach((lon, k) => {
				const next = k + 1 < sorted.length ? sorted[k + 1] : sorted[0] + 360
				widest = Math.max(widest, next - lon)
			})
			const span = 360 - widest
			return {
				peak: listed,
				ok: span <= check.maxSpanDeg,
				note: `span ${span.toFixed(1)} deg`,
			}
		}
		case "closestApproach": {
			const body = astronomyBody(check.body)
			const distance = (ms: number) =>
				Astronomy.GeoVector(body, new Date(ms), false).Length() * AU_KM
			const peak = minimize(
				distance,
				listed.getTime() - 5 * 86_400_000,
				listed.getTime() + 5 * 86_400_000,
			)
			return {
				peak: new Date(peak),
				ok:
					Math.abs(distance(peak) - check.distanceKm) <
					0.001 * check.distanceKm,
				note: `${(distance(peak) / 1e6).toFixed(3)} million km`,
			}
		}
		case "moonShadow": {
			// Io's shadow: the Sun -> Io axis passes Jupiter's centre closest
			const jupiterRadiusAu = (bodyById.get("jupiter")?.radiusKm ?? 0) / AU_KM
			const miss = (ms: number) => {
				const date = new Date(ms)
				const moons = Astronomy.JupiterMoons(date)
				const moon = moons[check.moon as keyof Astronomy.JupiterMoonsInfo]
				const jupiter = Astronomy.HelioVector(Astronomy.Body.Jupiter, date)
				const io = [jupiter.x + moon.x, jupiter.y + moon.y, jupiter.z + moon.z]
				const length = Math.hypot(io[0], io[1], io[2])
				const u = io.map((v) => v / length)
				const rel = [jupiter.x - io[0], jupiter.y - io[1], jupiter.z - io[2]]
				const along = rel[0] * u[0] + rel[1] * u[1] + rel[2] * u[2]
				if (along <= 0) return Number.POSITIVE_INFINITY
				return Math.hypot(
					rel[0] - along * u[0],
					rel[1] - along * u[1],
					rel[2] - along * u[2],
				)
			}
			const peak = minimize(
				miss,
				listed.getTime() - HOUR,
				listed.getTime() + HOUR,
			)
			return {
				peak: new Date(peak),
				ok: miss(peak) < 0.5 * jupiterRadiusAu,
				note: `axis ${(miss(peak) / jupiterRadiusAu).toFixed(2)} Jupiter radii from the centre`,
			}
		}
		case "ringPlaneCrossing": {
			const tilt = (ms: number) =>
				Math.abs(
					Astronomy.Illumination(astronomyBody(check.body), new Date(ms))
						.ring_tilt ?? 90,
				)
			const peak = minimize(
				tilt,
				listed.getTime() - 5 * 86_400_000,
				listed.getTime() + 5 * 86_400_000,
			)
			return {
				peak: new Date(peak),
				ok: tilt(peak) < 0.01,
				note: `tilt ${tilt(peak).toFixed(4)} deg`,
			}
		}
		case "visible": {
			const elongation = Astronomy.Elongation(
				astronomyBody(check.body),
				listed,
			).elongation
			return {
				peak: listed,
				ok: elongation >= check.minElongationDeg,
				note: `${elongation.toFixed(1)} deg from the Sun`,
			}
		}
		case "moment":
			return { peak: listed, ok: true, note: "a moment in history" }
	}
}

/** How close (minutes) the listed instant must be to the real one. */
const LISTED_TOLERANCE_MIN: Record<EventCheck["kind"], number> = {
	solarEclipse: 2,
	lunarEclipse: 2,
	transit: 2,
	conjunction: 30,
	gathering: 0,
	closestApproach: 30,
	moonShadow: 5,
	ringPlaneCrossing: 60,
	visible: 0,
	moment: 0,
}

describe("the sky events file", () => {
	it("matches the schema, with unique ids, known bodies and every group used", () => {
		const parsed = SkyEventSchema.array().safeParse(skyEventsFile)
		expect(parsed.error?.issues ?? []).toEqual([])
		const ids = SKY_EVENTS.map((event) => event.id)
		expect(new Set(ids).size).toBe(ids.length)
		for (const group of EVENT_GROUPS) {
			expect(eventsInGroup(group).length, group).toBeGreaterThan(0)
		}
		for (const event of SKY_EVENTS) {
			const check = event.check as Record<string, unknown>
			const named = [
				check.body,
				check.moon,
				...((check.bodies as string[] | undefined) ?? []),
				event.space?.body,
				event.earth?.body,
			].filter((id): id is string => typeof id === "string")
			for (const id of named)
				expect(bodyById.has(id), `${event.id}: ${id}`).toBe(true)
			if (event.space?.craft !== undefined) {
				expect(spacecraftById.has(event.space.craft), event.space.craft).toBe(
					true,
				)
			}
		}
	})

	it("reaches into the future in every sky group: a class cares about the next one", () => {
		const catalogueDate = "2026-09-25"
		for (const group of EVENT_GROUPS.filter((g) => g !== "history")) {
			expect(
				eventsInGroup(group).some((event) => event.utc > catalogueDate),
				group,
			).toBe(true)
		}
	})
})

describe.each(SKY_EVENTS.map((event) => [event.id, event] as const))(
	"%s",
	(_, event) => {
		it("is real: astronomy-engine agrees with the listed instant", () => {
			const real = realPeak(event)
			expect(real.ok, real.note).toBe(true)
			expect(
				minutesBetween(real.peak, new Date(event.utc)),
				real.note,
			).toBeLessThanOrEqual(LISTED_TOLERANCE_MIN[event.check.kind])
		})

		it("really happens in the app's simulation, close to the real instant", () => {
			const realJD = dateToJD(new Date(event.utc))
			const simJD = bestInstant(geometry, event.check, realJD)
			const measure = measureEvent(geometry, event.check, simJD)
			expect(measure.happens, JSON.stringify(measure)).toBe(true)
			const hours = Math.abs(simJD - realJD) * 24
			expect(hours).toBeLessThanOrEqual(TOLERANCE_HOURS[event.check.kind])
			// the best instant is a true minimum inside the search window, not its edge
			const window = SEARCH_WINDOW_DAYS[event.check.kind]
			if (window > 0)
				expect(Math.abs(simJD - realJD)).toBeLessThan(window * 0.95)
		})
	},
)
