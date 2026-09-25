/**
 * How a sky event is staged (#41): the event becomes a guided tour (#28's
 * format and player) with one stop per view. The first stop sets the whole
 * scene: the simulation's instant of the event (`time: { event }`), the clock
 * paused, true scale (an eclipse only works at true proportions), the layers,
 * and the view from space; the second, where it helps, is the view from
 * Earth: the camera standing on the Earth (where the event is seen best)
 * looking at it through a lens as narrow as it needs. The tour returns on
 * exit, so leaving is one action.
 *
 * The cameras follow from the event's check, computed from TRUE positions at
 * the instant the simulation shows the event, so every event of a kind is
 * framed alike; discoveries and missions name their body in the data.
 */
import { AU_KM, radToDeg } from "@/sim"
import { EARTH, SUN, eclipticLongitudeDeg } from "@/sim/skyEvents"
import { eventTourId, type SkyEvent } from "@/data/skyEvents"
import type { Tour, TourStop } from "@/data/tours"
import { MAX_ELEVATION_DEG } from "@/store/navigation"

import { eventJD, eventMeasure, skyGeometry } from "./instant"

/** The scale every event is shown in: the only one in which shadows, sizes and gaps are the real ones. */
export const EVENT_SCALE = "trueScale"

/** The two views of an event. */
export const EVENT_VIEWS = ["space", "earth"] as const
export type EventView = (typeof EVENT_VIEWS)[number]

type Vec = readonly [number, number, number]

/** Camera azimuth and elevation (camera-controls: azimuth 0 = scene +Z) looking back along `v`. */
function angles(v: Vec): { azimuth: number; elevation: number } {
	const length = Math.hypot(v[0], v[1], v[2])
	const elevation = radToDeg(Math.asin(v[1] / length))
	return {
		azimuth: radToDeg(Math.atan2(v[0], v[2])),
		elevation: Math.max(
			-MAX_ELEVATION_DEG,
			Math.min(MAX_ELEVATION_DEG, elevation),
		),
	}
}

const sub = (a: ArrayLike<number>, b: ArrayLike<number>): Vec => [
	a[0] - b[0],
	a[1] - b[1],
	a[2] - b[2],
]

/** `v` turned about the ecliptic pole (scene +Y) by `deg`. */
function turn(v: Vec, deg: number): Vec {
	const a = (deg * Math.PI) / 180
	const c = Math.cos(a)
	const s = Math.sin(a)
	return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]
}

/** `v` tilted toward the ecliptic pole by `deg` (keeping its direction round the pole). */
function lift(v: Vec, deg: number): Vec {
	const flat = Math.hypot(v[0], v[2])
	const elevation = Math.atan2(v[1], flat) + (deg * Math.PI) / 180
	const length = Math.hypot(v[0], v[1], v[2])
	const k = flat > 0 ? (Math.cos(elevation) * length) / flat : 0
	return [v[0] * k, Math.sin(elevation) * length, v[2] * k]
}

/** Top-down over the Sun, framing `au` astronomical units. */
const topDown = (au: number): Pick<TourStop, "view" | "camera" | "fit"> => ({
	view: "overview",
	camera: { azimuth: 0, elevation: MAX_ELEVATION_DEG },
	fit: { au },
})

const heliocentricAu = (id: string, jd: number): number => {
	const p = skyGeometry().position(id, jd)
	return Math.hypot(p[0], p[1], p[2]) / AU_KM
}

/** The view from space: where to look from and what to select. */
function spaceStop(event: SkyEvent, jd: number): Omit<TourStop, "id"> {
	const geometry = skyGeometry()
	const check = event.check
	switch (check.kind) {
		case "solarEclipse": {
			// straight down onto the point of greatest eclipse: the Moon's shadow on the day side
			const point = eventMeasure(event).surfaceKm ?? [0, 1, 0]
			return {
				view: EARTH,
				camera: { ...angles(point), distance: 0.6 },
				select: EARTH,
			}
		}
		case "lunarEclipse": {
			// side-on to the Sun -> Earth -> Moon line, the Moon's orbit in the frame
			const toSun = sub(
				geometry.position(SUN, jd),
				geometry.position(EARTH, jd),
			)
			const side = lift(turn(toSun, 90), 20)
			const moonKm = Math.hypot(...geometry.fromEarth("moon", jd))
			return {
				view: EARTH,
				camera: angles(side),
				fit: { km: moonKm * 1.15, around: EARTH },
				select: "moon",
			}
		}
		case "transit":
			return { ...topDown(1.25), select: check.body }
		case "conjunction":
		case "gathering": {
			const ids = check.kind === "conjunction" ? check.bodies : check.bodies
			const far = Math.max(1, ...ids.map((id) => heliocentricAu(id, jd)))
			return {
				...topDown(far * 1.1),
				select: check.kind === "conjunction" ? check.bodies[0] : null,
			}
		}
		case "closestApproach":
			return {
				...topDown(Math.max(1, heliocentricAu(check.body, jd)) * 1.15),
				select: check.body,
			}
		case "moonShadow": {
			// the planet from nearly the Sun's direction: the moon's shadow on its day side
			const planet =
				geometry.bodies[geometry.index.get(check.moon) ?? 0].parentId ?? EARTH
			const toSun = sub(
				geometry.position(SUN, jd),
				geometry.position(planet, jd),
			)
			return {
				view: planet,
				camera: { ...angles(lift(turn(toSun, 12), 8)), distance: 0.55 },
				select: check.moon,
			}
		}
		case "ringPlaneCrossing": {
			// the rings from the sunlit side, a little above their plane
			const toSun = sub(
				geometry.position(SUN, jd),
				geometry.position(check.body, jd),
			)
			return {
				view: check.body,
				camera: { ...angles(lift(turn(toSun, 35), 18)), distance: 1.3 },
				select: check.body,
			}
		}
		case "visible":
		case "moment": {
			const space = event.space ?? {}
			if (space.fitAu !== undefined) {
				return { ...topDown(space.fitAu), select: null }
			}
			const body = space.body ?? EARTH
			return {
				view: body,
				select: space.craft === undefined ? body : null,
			}
		}
	}
}

/** Degrees of lens for a telescope on each kind of event (the height of the view). */
const TELESCOPE_DEG = {
	solarEclipse: 2,
	lunarEclipse: 2.5,
	transit: 0.9,
	closestApproach: 0.02,
	moonShadow: 0.03,
	ringPlaneCrossing: 0.035,
} as const

/** The view from Earth, or null when there is none worth showing. */
function earthStop(event: SkyEvent, jd: number): Omit<TourStop, "id"> | null {
	const check = event.check
	const telescope = (body: string, fov: number): Omit<TourStop, "id"> => ({
		view: body,
		camera: { from: "earth", fov },
		select: body,
		move: "glide",
	})
	switch (check.kind) {
		case "solarEclipse":
			// the Moon in front of the Sun, from the path of totality
			return { ...telescope("moon", TELESCOPE_DEG.solarEclipse), select: null }
		case "lunarEclipse":
			return telescope("moon", TELESCOPE_DEG.lunarEclipse)
		case "transit":
			return { ...telescope(SUN, TELESCOPE_DEG.transit), select: check.body }
		case "conjunction": {
			const [a] = check.bodies
			const angle = eventMeasure(event).angleDeg ?? 1
			return telescope(a, Math.min(30, Math.max(0.3, angle * 4)))
		}
		case "gathering": {
			// looking along the arc the planets make in our sky, centred on its middle
			const geometry = skyGeometry()
			const longitudes = check.bodies.map((id) =>
				eclipticLongitudeDeg(geometry.fromEarth(id, jd)),
			)
			const sorted = [...longitudes].sort((x, y) => x - y)
			let gap = -1
			let start = sorted[0]
			sorted.forEach((lon, k) => {
				const next = k + 1 < sorted.length ? sorted[k + 1] : sorted[0] + 360
				if (next - lon > gap) {
					gap = next - lon
					start = next % 360
				}
			})
			const span = 360 - gap
			const middle = (start + span / 2) % 360
			const offset = (lon: number) =>
				Math.abs(((lon - middle + 540) % 360) - 180)
			let centre = check.bodies[0]
			check.bodies.forEach((id, k) => {
				if (
					offset(longitudes[k]) <
					offset(longitudes[check.bodies.indexOf(centre)])
				) {
					centre = id
				}
			})
			return {
				...telescope(centre, Math.min(120, span * 0.8 + 6)),
				select: null,
			}
		}
		case "closestApproach":
			return telescope(check.body, TELESCOPE_DEG.closestApproach)
		case "moonShadow": {
			const geometry = skyGeometry()
			const planet =
				geometry.bodies[geometry.index.get(check.moon) ?? 0].parentId ?? EARTH
			return {
				...telescope(planet, TELESCOPE_DEG.moonShadow),
				select: check.moon,
			}
		}
		case "ringPlaneCrossing":
			return telescope(check.body, TELESCOPE_DEG.ringPlaneCrossing)
		case "visible":
		case "moment":
			return event.earth === undefined
				? null
				: telescope(event.earth.body, event.earth.fovDeg)
	}
}

/**
 * The event as a tour (#28): the view from space, then (where it helps) the
 * view from Earth. `fly`: the move into the event is a flight (from another
 * body); otherwise a glide.
 */
export function eventTour(event: SkyEvent, fly = false): Tour {
	const jd = eventJD(event)
	const space: TourStop = {
		id: "space",
		...spaceStop(event, jd),
		time: { event: event.id },
		speed: "paused",
		scale: EVENT_SCALE,
		layers: { orbits: true, labels: true, markers: true, moons: true },
		move: fly ? "fly" : "glide",
	}
	const earth = earthStop(event, jd)
	return {
		id: eventTourId(event.id),
		order: 0,
		returnOnExit: true,
		stops: earth === null ? [space] : [space, { id: "earth", ...earth }],
	}
}

/** The index of a view among an event tour's stops (null: the event has no such view). */
export const viewIndex = (tour: Tour, view: EventView): number | null => {
	const index = tour.stops.findIndex((stop) => stop.id === view)
	return index < 0 ? null : index
}
