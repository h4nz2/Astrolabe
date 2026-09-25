/**
 * Sky events (#41): the geometry that says whether an eclipse, a transit, a
 * conjunction, a gathering of planets, a close approach, a moon's shadow or a
 * ring-plane crossing really happens in the app's own simulation, and the
 * instant at which the simulation shows it best.
 *
 * The app's orbits reproduce real events within hours (the Moon has no
 * evection or variation; planets are a few tenths of a degree off), so an
 * event is not shown at its real instant but at the one where the SIMULATION
 * shows it best: `bestInstant` searches around the real instant for the
 * minimum of the event's measure. `src/sim/skyEvents.test.ts` checks every
 * listed event against astronomy-engine (the real instant) and against this
 * module (it happens in the scene, close enough to the real instant).
 *
 * Everything is measured in TRUE km (`positionsKm`), never in display space,
 * like the lighting (#22): an eclipse is the same in every scale preset.
 * Pure: no React, no three.js.
 */
import { angleBetween, sunVisibleFraction } from "./lighting"
import { truePositionAt } from "./light"
import { buildIndex, type OrbitingBody } from "./positions"
import { spinAxis, type RotationElements } from "./rotation"
import { radToDeg } from "./kepler"

/** What the event geometry needs of a body (a schema `Body` satisfies it). */
export interface EventBody extends OrbitingBody {
	readonly radiusKm: number
	readonly rotation: Pick<
		RotationElements,
		"axialTiltDeg" | "poleRaDeg" | "poleDecDeg"
	>
}

/** What an event checks, and between which bodies. */
export type EventCheck =
	/** The Moon's shadow falls on the Earth. */
	| { readonly kind: "solarEclipse"; readonly type: "total" | "annular" }
	/** The Moon passes through the Earth's shadow. */
	| { readonly kind: "lunarEclipse"; readonly type: "total" | "partial" }
	/** A planet crosses the Sun's disc, seen from the Earth. */
	| { readonly kind: "transit"; readonly body: string }
	/** Two bodies closer than `maxDeg` in the Earth's sky. */
	| {
			readonly kind: "conjunction"
			readonly bodies: readonly [string, string]
			readonly maxDeg: number
	  }
	/** Every body within an arc of `maxSpanDeg` of the Earth's sky, measured along the ecliptic. */
	| {
			readonly kind: "gathering"
			readonly bodies: readonly string[]
			readonly maxSpanDeg: number
	  }
	/** A body at its closest to the Earth (`distanceKm`: the real closest distance). */
	| {
			readonly kind: "closestApproach"
			readonly body: string
			readonly distanceKm: number
	  }
	/** A moon's shadow on its planet (a solar eclipse seen from space). */
	| { readonly kind: "moonShadow"; readonly moon: string }
	/** The Earth passes through a planet's ring plane: the rings are edge-on. */
	| { readonly kind: "ringPlaneCrossing"; readonly body: string }
	/** A body stands at least `minElongationDeg` from the Sun in the Earth's sky (a discovery). */
	| {
			readonly kind: "visible"
			readonly body: string
			readonly minElongationDeg: number
	  }
	/** Nothing to check: a moment in history shown on its body (a launch, a landing). */
	| { readonly kind: "moment" }

export type EventCheckKind = EventCheck["kind"]

/**
 * How far from the real instant the simulation may show an event, days. The
 * search looks this far either side; an event whose best instant lies at the
 * edge is not reproduced. Eclipses: the Moon's model error is up to about
 * three hours (#22). Planets move slowly across the sky, so conjunctions and
 * close approaches may shift by days.
 */
export const SEARCH_WINDOW_DAYS: Readonly<Record<EventCheckKind, number>> = {
	solarEclipse: 0.25,
	lunarEclipse: 0.25,
	transit: 0.25,
	conjunction: 3,
	gathering: 0,
	closestApproach: 3,
	moonShadow: 0.1,
	ringPlaneCrossing: 10,
	visible: 0,
	moment: 0,
}

/**
 * How far the instant the simulation shows may lie from the real one, hours
 * (the promise the tests keep for every listed event). Totality lasts
 * minutes, so an eclipse is shown at the simulation's own greatest eclipse,
 * while the text gives the real time.
 */
export const TOLERANCE_HOURS: Readonly<Record<EventCheckKind, number>> = {
	solarEclipse: 3.5,
	lunarEclipse: 3.5,
	transit: 6,
	conjunction: 24,
	gathering: 0,
	closestApproach: 12,
	moonShadow: 1,
	ringPlaneCrossing: 72,
	visible: 0,
	moment: 0,
}

/** What the geometry found at one instant. */
export interface EventMeasure {
	/** The quantity the search minimizes (its unit depends on the check). */
	metric: number
	/** Whether the event is under way at this instant, as the check defines it. */
	happens: boolean
	/** Solar eclipse / moon shadow: the least sunlight on the receiver (0 = umbra). */
	sunlight?: number
	/** What kind of eclipse the geometry makes: "total", "annular", "partial", "penumbral" or "none". */
	type?: string
	/**
	 * Where an observer stands to see it (true km from the receiver's
	 * centre, scene axes): a solar eclipse's point of greatest eclipse, the
	 * point under the Moon for a lunar eclipse, under the Sun for a transit.
	 */
	surfaceKm?: [number, number, number]
	/** The angle the check measured, degrees (separation, span, ring tilt, elongation). */
	angleDeg?: number
	/** Closest approach: the distance, km. */
	distanceKm?: number
}

/** The positions the geometry reads, for one set of bodies. */
export class SkyGeometry {
	readonly index: ReadonlyMap<string, number>
	private readonly scratch = new Float64Array(3)

	constructor(readonly bodies: readonly EventBody[]) {
		this.index = buildIndex(bodies)
	}

	has(id: string): boolean {
		return this.index.has(id)
	}

	/** TRUE position of body `id` at `jd` (km, scene axes, Sun-centred). */
	position(id: string, jd: number, out = new Float64Array(3)): Float64Array {
		const i = this.index.get(id)
		if (i === undefined) throw new Error(`skyEvents: unknown body "${id}"`)
		return truePositionAt(this.bodies, this.index, i, jd, out)
	}

	radius(id: string): number {
		const i = this.index.get(id)
		return i === undefined ? 0 : this.bodies[i].radiusKm
	}

	/** Unit vector of the body's rotation pole (scene axes). */
	pole(id: string): [number, number, number] {
		const i = this.index.get(id)
		if (i === undefined) return [0, 1, 0]
		const body = this.bodies[i]
		const axis = spinAxis(body.rotation, body.orbit)
		return [axis.x, axis.y, axis.z]
	}

	/** Direction from the Earth's centre to body `id` at `jd` (not normalized), true km. */
	fromEarth(id: string, jd: number, out = new Float64Array(3)): Float64Array {
		const earth = this.position(EARTH, jd, this.scratch)
		const [ex, ey, ez] = [earth[0], earth[1], earth[2]]
		this.position(id, jd, out)
		out[0] -= ex
		out[1] -= ey
		out[2] -= ez
		return out
	}
}

export const SUN = "sun"
export const EARTH = "earth"
export const MOON = "moon"

const sub = (
	a: ArrayLike<number>,
	b: ArrayLike<number>,
): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: ArrayLike<number>, b: ArrayLike<number>): number =>
	a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: ArrayLike<number>): number => Math.hypot(a[0], a[1], a[2])

/** Ecliptic longitude (degrees, 0..360) of a scene-axes direction (ecliptic x, y, z = scene x, -z, y). */
export const eclipticLongitudeDeg = (v: ArrayLike<number>): number => {
	const deg = radToDeg(Math.atan2(-v[2], v[0]))
	return deg < 0 ? deg + 360 : deg
}

/**
 * The smallest arc (degrees) of ecliptic longitude that holds every
 * longitude in `lons`, and its middle: 360 minus the widest gap between
 * neighbours.
 */
export function longitudeArc(lons: readonly number[]): {
	spanDeg: number
	middleDeg: number
} {
	if (lons.length === 0) return { spanDeg: 0, middleDeg: 0 }
	const sorted = [...lons].sort((a, b) => a - b)
	let widestGap = -1
	let start = sorted[0]
	for (let k = 0; k < sorted.length; k++) {
		const here = sorted[k]
		const next = k + 1 < sorted.length ? sorted[k + 1] : sorted[0] + 360
		if (next - here > widestGap) {
			widestGap = next - here
			start = next % 360
		}
	}
	const spanDeg = sorted.length === 1 ? 0 : 360 - widestGap
	return { spanDeg, middleDeg: (start + spanDeg / 2) % 360 }
}

/**
 * A caster's shadow on a receiver (the Moon on the Earth, Io on Jupiter):
 * where the Sun -> caster axis meets the receiver, and how much sunlight is
 * left there. `metric` is how far the axis passes from the receiver's
 * centre, in receiver radii (infinite while the caster is not sunward of it).
 */
function shadowOn(
	geometry: SkyGeometry,
	caster: string,
	receiver: string,
	jd: number,
): EventMeasure {
	const s = geometry.position(SUN, jd)
	const c = geometry.position(caster, jd)
	const r = geometry.position(receiver, jd)
	const receiverRadius = geometry.radius(receiver)
	const casterRadius = geometry.radius(caster)
	const axis = sub(c, s)
	const axisLength = norm(axis)
	const u = [axis[0] / axisLength, axis[1] / axisLength, axis[2] / axisLength]
	const toReceiver = sub(r, c)
	const along = dot(toReceiver, u)
	if (along <= 0) {
		return { metric: Number.POSITIVE_INFINITY, happens: false, type: "none" }
	}
	// the point of the axis nearest the receiver's centre, relative to that centre
	const nearest = [
		c[0] + along * u[0] - r[0],
		c[1] + along * u[1] - r[1],
		c[2] + along * u[2] - r[2],
	]
	const miss = norm(nearest)
	// where the axis enters the receiver (its sunward side), else the surface point nearest the axis
	let point: [number, number, number]
	if (miss < receiverRadius) {
		const back = Math.sqrt(receiverRadius * receiverRadius - miss * miss)
		point = [
			nearest[0] - back * u[0],
			nearest[1] - back * u[1],
			nearest[2] - back * u[2],
		]
	} else {
		const k = receiverRadius / miss
		point = [nearest[0] * k, nearest[1] * k, nearest[2] * k]
	}
	const sun = sub(s, r)
	const casterRel = sub(c, r)
	const packed = [casterRel[0], casterRel[1], casterRel[2], casterRadius]
	const sunlight = sunVisibleFraction(
		point[0],
		point[1],
		point[2],
		sun[0],
		sun[1],
		sun[2],
		geometry.radius(SUN),
		packed,
		1,
	)
	// total when the caster looks bigger than the Sun from that point, annular when it sits inside it
	const toSun = sub(sun, point)
	const toCaster = sub(casterRel, point)
	const sunAngle = Math.asin(geometry.radius(SUN) / norm(toSun))
	const casterAngle = Math.asin(Math.min(casterRadius / norm(toCaster), 1))
	const offset = angleBetween(
		toSun[0],
		toSun[1],
		toSun[2],
		toCaster[0],
		toCaster[1],
		toCaster[2],
	)
	let type = "none"
	if (offset < sunAngle + casterAngle) type = "partial"
	if (offset <= casterAngle - sunAngle) type = "total"
	else if (offset <= sunAngle - casterAngle) type = "annular"
	return {
		metric: miss / receiverRadius,
		happens: type === "total" || type === "annular",
		sunlight,
		type,
		surfaceKm: point,
	}
}

/**
 * The Moon in the Earth's shadow. `metric` is the distance of the Moon's
 * centre from the shadow's axis, in Earth radii. Total when even the Moon's
 * limb farthest from the axis gets no direct sunlight, partial when the limb
 * nearest the axis is in the umbra, penumbral otherwise.
 */
function lunarEclipse(geometry: SkyGeometry, jd: number): EventMeasure {
	const s = geometry.position(SUN, jd)
	const e = geometry.position(EARTH, jd)
	const m = geometry.position(MOON, jd)
	const earthRadius = geometry.radius(EARTH)
	const moonRadius = geometry.radius(MOON)
	const axis = sub(e, s)
	const axisLength = norm(axis)
	const u = [axis[0] / axisLength, axis[1] / axisLength, axis[2] / axisLength]
	const moon = sub(m, e)
	const along = dot(moon, u)
	if (along <= 0) {
		return { metric: Number.POSITIVE_INFINITY, happens: false, type: "none" }
	}
	const off = [
		moon[0] - along * u[0],
		moon[1] - along * u[1],
		moon[2] - along * u[2],
	]
	const miss = norm(off)
	const out =
		miss > 0 ? [off[0] / miss, off[1] / miss, off[2] / miss] : [1, 0, 0]
	const sun = sub(s, e)
	const earthCaster = [0, 0, 0, earthRadius]
	const sunlightAt = (k: number) =>
		sunVisibleFraction(
			moon[0] + k * moonRadius * out[0],
			moon[1] + k * moonRadius * out[1],
			moon[2] + k * moonRadius * out[2],
			sun[0],
			sun[1],
			sun[2],
			geometry.radius(SUN),
			earthCaster,
			1,
		)
	const far = sunlightAt(1)
	const near = sunlightAt(-1)
	const centre = sunlightAt(0)
	const type =
		far === 0
			? "total"
			: near === 0
				? "partial"
				: centre < 1 || near < 1
					? "penumbral"
					: "none"
	// the observer: the point of the Earth's surface under the Moon
	const k = earthRadius / norm(moon)
	return {
		metric: miss / earthRadius,
		happens: type === "total" || type === "partial",
		sunlight: centre,
		type,
		surfaceKm: [moon[0] * k, moon[1] * k, moon[2] * k],
	}
}

/** A planet across the Sun's disc, seen from the Earth's centre. `metric`: the separation, degrees. */
function transit(
	geometry: SkyGeometry,
	body: string,
	jd: number,
): EventMeasure {
	const sun = geometry.fromEarth(SUN, jd)
	const planet = geometry.fromEarth(body, jd)
	const sunDistance = norm(sun)
	const planetDistance = norm(planet)
	const separation = radToDeg(
		angleBetween(sun[0], sun[1], sun[2], planet[0], planet[1], planet[2]),
	)
	const sunRadius = radToDeg(Math.asin(geometry.radius(SUN) / sunDistance))
	const nearer = planetDistance < sunDistance
	const metric = nearer ? separation : Number.POSITIVE_INFINITY
	const k = geometry.radius(EARTH) / sunDistance
	return {
		metric,
		happens: nearer && separation < sunRadius,
		angleDeg: separation,
		type: nearer && separation < sunRadius ? "transit" : "none",
		surfaceKm: [sun[0] * k, sun[1] * k, sun[2] * k],
	}
}

/** Angle between two bodies in the Earth's sky, degrees. */
export function separationFromEarthDeg(
	geometry: SkyGeometry,
	a: string,
	b: string,
	jd: number,
): number {
	const va = geometry.fromEarth(a, jd)
	const vb = geometry.fromEarth(b, jd, new Float64Array(3))
	return radToDeg(angleBetween(va[0], va[1], va[2], vb[0], vb[1], vb[2]))
}

/** Ecliptic longitudes (degrees) of `ids` seen from the Earth at `jd`. */
export function longitudesFromEarth(
	geometry: SkyGeometry,
	ids: readonly string[],
	jd: number,
): number[] {
	return ids.map((id) => eclipticLongitudeDeg(geometry.fromEarth(id, jd)))
}

/**
 * Elevation (degrees) of the Earth above body `id`'s equatorial plane, seen
 * from the body: 0 when its rings are edge-on to us.
 */
export function ringTiltFromEarthDeg(
	geometry: SkyGeometry,
	id: string,
	jd: number,
): number {
	const toEarth = geometry.fromEarth(id, jd)
	const pole = geometry.pole(id)
	const d = norm(toEarth)
	return radToDeg(Math.asin(-dot(toEarth, pole) / d))
}

/** Measures `check` at `jd` in the geometry's simulation. */
export function measureEvent(
	geometry: SkyGeometry,
	check: EventCheck,
	jd: number,
): EventMeasure {
	switch (check.kind) {
		case "solarEclipse": {
			const measure = shadowOn(geometry, MOON, EARTH, jd)
			return { ...measure, happens: measure.type === check.type }
		}
		case "lunarEclipse": {
			const measure = lunarEclipse(geometry, jd)
			const happens =
				check.type === "total"
					? measure.type === "total"
					: measure.type === "total" || measure.type === "partial"
			return { ...measure, happens }
		}
		case "transit":
			return transit(geometry, check.body, jd)
		case "conjunction": {
			const [a, b] = check.bodies
			const angleDeg = separationFromEarthDeg(geometry, a, b, jd)
			return { metric: angleDeg, happens: angleDeg <= check.maxDeg, angleDeg }
		}
		case "gathering": {
			const { spanDeg } = longitudeArc(
				longitudesFromEarth(geometry, check.bodies, jd),
			)
			return {
				metric: spanDeg,
				happens: spanDeg <= check.maxSpanDeg,
				angleDeg: spanDeg,
			}
		}
		case "closestApproach": {
			const distanceKm = norm(geometry.fromEarth(check.body, jd))
			// within 1 % of the real closest distance
			const happens =
				Math.abs(distanceKm - check.distanceKm) <= 0.01 * check.distanceKm
			return { metric: distanceKm, happens, distanceKm }
		}
		case "moonShadow": {
			const i = geometry.index.get(check.moon)
			const planet = i === undefined ? null : geometry.bodies[i].parentId
			if (planet === null) {
				return { metric: Number.POSITIVE_INFINITY, happens: false }
			}
			const measure = shadowOn(geometry, check.moon, planet, jd)
			// the moon's umbra (or a near-total penumbra) lies on the planet
			return {
				...measure,
				happens: measure.metric < 1 && (measure.sunlight ?? 1) < 0.2,
			}
		}
		case "ringPlaneCrossing": {
			const tilt = ringTiltFromEarthDeg(geometry, check.body, jd)
			return {
				metric: Math.abs(tilt),
				happens: Math.abs(tilt) < RING_EDGE_ON_DEG,
				angleDeg: tilt,
			}
		}
		case "visible": {
			const angleDeg = separationFromEarthDeg(geometry, check.body, SUN, jd)
			return {
				metric: -angleDeg,
				happens: angleDeg >= check.minElongationDeg,
				angleDeg,
			}
		}
		case "moment":
			return { metric: 0, happens: true }
	}
}

/**
 * The rings count as edge-on while the Earth is within this angle of their
 * plane: Saturn's main rings, 270,000 km across and a few tens of metres
 * thick, are then a line no telescope resolves into an ellipse.
 */
export const RING_EDGE_ON_DEG = 0.1

/** Samples of the coarse scan before the golden-section refinement. */
const SCAN_SAMPLES = 96
const GOLDEN = (Math.sqrt(5) - 1) / 2

/**
 * The instant within `windowDays` of `jd` where the simulation shows
 * `check` best (the least metric): a coarse scan, then a golden-section
 * search around its best sample, to a few seconds. Checks without a window
 * (gatherings, discoveries, moments) stay at `jd`.
 */
export function bestInstant(
	geometry: SkyGeometry,
	check: EventCheck,
	jd: number,
	windowDays: number = SEARCH_WINDOW_DAYS[check.kind],
): number {
	if (!(windowDays > 0)) return jd
	const metric = (t: number) => measureEvent(geometry, check, t).metric
	const step = (2 * windowDays) / SCAN_SAMPLES
	let best = jd
	let bestValue = metric(jd)
	for (let k = 0; k <= SCAN_SAMPLES; k++) {
		const t = jd - windowDays + k * step
		const value = metric(t)
		if (value < bestValue) {
			best = t
			bestValue = value
		}
	}
	let a = Math.max(jd - windowDays, best - step)
	let b = Math.min(jd + windowDays, best + step)
	let c = b - GOLDEN * (b - a)
	let d = a + GOLDEN * (b - a)
	let fc = metric(c)
	let fd = metric(d)
	// to about 1 second
	while (b - a > 1e-5) {
		if (fc < fd) {
			b = d
			d = c
			fd = fc
			c = b - GOLDEN * (b - a)
			fc = metric(c)
		} else {
			a = c
			c = d
			fc = fd
			d = a + GOLDEN * (b - a)
			fd = metric(d)
		}
	}
	const refined = (a + b) / 2
	return metric(refined) <= bestValue ? refined : best
}
