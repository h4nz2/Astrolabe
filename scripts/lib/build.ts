/**
 * Pure transformation data/ourDB.json -> Body[] (see docs/ARCHITECTURE.md, "Data model").
 *
 * No I/O happens here: the caller passes the parsed source, a `fileExists` check for
 * public/ paths and a `ringsFor` lookup for the ring files other agents produce.
 * That keeps the mapping unit-testable with small fixtures.
 */
import { Rings as RingsSchema } from "../../src/data/schema"
import type {
	Body,
	BodyKind,
	BodyTextures,
	Orbit,
	Rings,
	Rotation,
} from "../../src/data/schema"
import type { Vec3 } from "../../src/sim/kepler"
import { eclipticDirection } from "../../src/sim/rotation"

import { rotateElementsToEcliptic } from "./frames"
import { spreadPhases } from "./hash"
import { IAU_ORIENTATIONS, PLANET_OBLATENESS } from "./iau"
import { slug } from "./names"
import { normalizeName } from "./names"
import { parseMass, parseNumber } from "./numbers"
import { densityKgPerM3, laplaceRadiusKm, periodDaysFromKepler } from "./orbit"
import {
	first,
	isRecord,
	nonZero,
	num,
	positive,
	positiveAbs,
	rec,
	records,
	str,
} from "./source"
import type { Raw } from "./source"

/** J2000 epoch as a Julian Date; every element in the source refers to it. */
export const J2000 = 2451545.0

/** Shared texture for moons that have none of their own. */
export const PLACEHOLDER_TEXTURE =
	"/assets/textures/earth/satellites/moon_1k.jpg"

/** Added to Earth when the file exists. */
export const EARTH_NIGHT_TEXTURE = "/assets/textures/earth_night_4k.jpg"

/** Radius for moons with neither a mean radius nor a diameter. */
export const DEFAULT_MOON_RADIUS_KM = 5

/** Planets with rings that the source does not describe; data/rings/<id>.json fills the gap. */
export const EXTERNAL_RING_PLANETS: readonly string[] = ["uranus", "neptune"]

/** A regular moon whose period is further than this from Kepler's third law gets a warning. */
export const KEPLER_PERIOD_TOLERANCE = 0.1

/** Mean densities outside this range (kg/m^3) get a warning: a mass or size typo. */
export const DENSITY_RANGE_KG_PER_M3: readonly [number, number] = [100, 10000]

/** Descriptive fields passed through into `info`, in output order. */
export const INFO_KEYS: readonly string[] = [
	"gravity",
	"density",
	"avgTemp",
	"discoveredBy",
	"discoveryDate",
	"alternativeName",
	"lengthOfDay",
	"orbitalVelocity",
	"composition",
	"mass",
	"vol",
	"dimension",
	"escape",
	"surfaceTemps",
	"flattening",
	"equaRadius",
	"polarRadius",
	"bodyType",
	// extra dictionary fields (src/data/solarDictionary.ts) so it can switch to bodies.json
	"diameter",
	"perihelion",
	"aphelion",
	"orbitalPeriod",
	"orbitalInclination",
	"axialTilt",
	"orbitPositionOffset",
]

const TEXTURE_KEYS = ["base", "topo", "specular", "clouds", "night"] as const
type TextureKey = (typeof TEXTURE_KEYS)[number]

export interface BuildOptions {
	/** true when a root-absolute public path ("/assets/...") exists on disk */
	fileExists: (publicPath: string) => boolean
	/** parsed data/rings/<planetId>.json, or null when there is no such file */
	ringsFor: (planetId: string) => unknown
}

export interface BuildStats {
	total: number
	perKind: Record<BodyKind, number>
	moonsPerPlanet: Record<string, number>
	radiusEstimated: number
	phaseSynthetic: number
	/** moons whose equator-relative source elements were rotated into the ecliptic */
	equatorRotated: number
	periodDerived: number
	placeholderTextures: number
	rings: number
}

export interface BuildResult {
	bodies: Body[]
	stats: BuildStats
	/** non-fatal findings, for stderr */
	warnings: string[]
}

/** A data problem that must stop the build (missing planet texture, malformed ring file, ...). */
export class BuildError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "BuildError"
	}
}

interface Context {
	options: BuildOptions
	warnings: string[]
	usedIds: Set<string>
	equatorRotated: number
}

interface MoonRecord {
	raw: Raw
	fromSatellites: boolean
}

interface PlanetInfo {
	id: string
	name: string
	massKg: number | null
	/** IAU north pole as an ecliptic unit vector; null without IAU data */
	poleEcliptic: Vec3 | null
	/** moons inside it have equator-relative source inclinations; null when it cannot be computed */
	laplaceRadiusKm: number | null
}

const round = (value: number, decimals: number): number => {
	const factor = 10 ** decimals
	return Math.round(value * factor) / factor
}

/** Three decimals, kept inside [0, 360) after rounding. */
const roundAngle = (deg: number): number => {
	const rounded = round(deg, 3)
	return rounded >= 360 ? 0 : rounded
}

const byOrbitThenId = (a: Body, b: Body): number => {
	const diff = (a.orbit?.semiMajorAxisKm ?? 0) - (b.orbit?.semiMajorAxisKm ?? 0)
	if (diff !== 0) return diff
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

const uniqueId = (
	base: string,
	parentId: string | null,
	ctx: Context,
): string => {
	let id = base
	if (ctx.usedIds.has(id) && parentId !== null) {
		id = `${base}${parentId}`
		ctx.warnings.push(`id collision: "${base}" is taken, using "${id}"`)
	}
	for (let n = 2; ctx.usedIds.has(id); n++) {
		id = `${base}${parentId ?? ""}${n}`
	}
	ctx.usedIds.add(id)
	return id
}

/** Drops null/undefined/"" everywhere and, at the top level, 0 (the source's "unknown"). */
const cleanInfoValue = (value: unknown, topLevel: boolean): unknown => {
	if (value === null || value === undefined) return undefined
	if (typeof value === "string") {
		return value.trim() === "" ? undefined : value
	}
	if (typeof value === "number") {
		if (!Number.isFinite(value)) return undefined
		return topLevel && value === 0 ? undefined : value
	}
	if (Array.isArray(value)) {
		const items = value
			.map((item) => cleanInfoValue(item, false))
			.filter((item) => item !== undefined)
		return items.length > 0 ? items : undefined
	}
	if (isRecord(value)) {
		const out: Raw = {}
		for (const [key, item] of Object.entries(value)) {
			const cleaned = cleanInfoValue(item, false)
			if (cleaned !== undefined) out[key] = cleaned
		}
		return Object.keys(out).length > 0 ? out : undefined
	}
	return value
}

const infoOf = (sources: readonly Raw[]): Record<string, unknown> => {
	const info: Record<string, unknown> = {}
	for (const key of INFO_KEYS) {
		for (const source of sources) {
			const value = cleanInfoValue(source[key], true)
			if (value !== undefined) {
				info[key] = value
				break
			}
		}
	}
	return info
}

/**
 * True when the shared placeholder is a real texture of this planet's moons (it depicts the
 * Moon, so under Earth it is the Moon's own map and keeps its bump map).
 */
export const ownsPlaceholderTexture = (planetId: string): boolean =>
	PLACEHOLDER_TEXTURE.startsWith(`/assets/textures/${planetId}/`)

/** A body drawn with the shared placeholder instead of a texture of its own. */
export const usesPlaceholderTexture = (
	body: Pick<Body, "parentId" | "textures">,
): boolean =>
	body.textures.base === PLACEHOLDER_TEXTURE &&
	(body.parentId === null || !ownsPlaceholderTexture(body.parentId))

const resolveTextures = (
	source: Raw | null,
	kind: BodyKind,
	label: string,
	ctx: Context,
	extra: Partial<Record<TextureKey, string>> = {},
): BodyTextures => {
	const wanted: Partial<Record<TextureKey, string>> = {}
	for (const key of TEXTURE_KEYS) {
		const path = str(source?.[key])
		if (path !== null) wanted[key] = path
	}
	Object.assign(wanted, extra)

	const found: Partial<Record<TextureKey, string>> = {}
	for (const key of TEXTURE_KEYS) {
		const path = wanted[key]
		if (path === undefined) continue
		if (ctx.options.fileExists(path)) {
			found[key] = path
		} else if (kind === "moon") {
			ctx.warnings.push(
				`${label}: texture ${key} "${path}" is missing under public/, dropped`,
			)
		} else {
			throw new BuildError(
				`${label}: texture ${key} "${path}" is missing under public/`,
			)
		}
	}

	if (found.base === undefined) {
		if (kind !== "moon") {
			throw new BuildError(`${label}: no base texture`)
		}
		return { base: PLACEHOLDER_TEXTURE }
	}
	const textures: BodyTextures = { base: found.base }
	for (const key of TEXTURE_KEYS) {
		if (key !== "base" && found[key] !== undefined) textures[key] = found[key]
	}
	return textures
}

const assemble = (
	fields: Omit<Body, "radiusEstimated"> & { radiusEstimated: boolean },
): Body => ({
	id: fields.id,
	name: fields.name,
	kind: fields.kind,
	parentId: fields.parentId,
	radiusKm: fields.radiusKm,
	...(fields.radiusEstimated ? { radiusEstimated: true } : {}),
	massKg: fields.massKg,
	orbit: fields.orbit,
	rotation: fields.rotation,
	textures: fields.textures,
	rings: fields.rings,
	info: fields.info,
})

const radiusOf = (
	sources: readonly Raw[],
	fallbackKm: number | null,
): { radiusKm: number; radiusEstimated: boolean } => {
	const meanRadius = first(sources, (raw) => positive(num(raw.meanRadius)))
	if (meanRadius !== null)
		return { radiusKm: meanRadius, radiusEstimated: false }
	const diameter = first(sources, (raw) => positive(num(raw.diameter)))
	if (diameter !== null)
		return { radiusKm: diameter / 2, radiusEstimated: true }
	if (fallbackKm === null) {
		throw new BuildError("no mean radius or diameter in the source")
	}
	return { radiusKm: fallbackKm, radiusEstimated: true }
}

/** Warns when mass and radius give a density no solid or gas body has: a typo in one of them. */
const checkDensity = (
	label: string,
	massKg: number | null,
	radiusKm: number,
	ctx: Context,
): void => {
	if (massKg === null) return
	const density = densityKgPerM3(massKg, radiusKm)
	const [min, max] = DENSITY_RANGE_KG_PER_M3
	if (density < min || density > max) {
		ctx.warnings.push(
			`${label}: mean density ${Math.round(density)} kg/m3 is implausible (mass ${massKg} kg, radius ${radiusKm} km)`,
		)
	}
}

/**
 * Spin from the source, normalized to one encoding of "retrograde". The export gives the
 * right-hand-rule obliquity (Venus 177.36, Uranus 97.77: above 90 means the spin vector
 * points south) AND flags the same fact with a negative `sideralRotation`. bodies.json keeps
 * the tilt to the IAU north pole (180 - tilt, so north-up maps stay upright) and lets the
 * period's sign alone carry the direction. IAU poles and prime meridians attach by id.
 */
const rotationOf = (sources: readonly Raw[], id: string): Rotation => {
	let periodHours = first(sources, (raw) => nonZero(num(raw.sideralRotation)))
	let axialTiltDeg = first(sources, (raw) => num(raw.axialTilt)) ?? 0
	if (axialTiltDeg > 90) {
		axialTiltDeg = round(180 - axialTiltDeg, 4)
		if (periodHours !== null) periodHours = -Math.abs(periodHours)
	}
	const iau = IAU_ORIENTATIONS[id]
	return iau === undefined
		? { periodHours, axialTiltDeg }
		: { periodHours, axialTiltDeg, ...iau }
}

const ringsOf = (raw: Raw, planetId: string, ctx: Context): Rings | null => {
	const source = rec(raw.rings)
	if (source !== null) {
		const inner = positive(num(source.innerRadius))
		const outer = positive(num(source.outerRadius))
		const textures = rec(source.textures)
		const alpha = str(textures?.base)
		const color = str(textures?.colorMap)
		if (inner === null || outer === null || alpha === null || color === null) {
			throw new BuildError(`${planetId}: incomplete ring data in the source`)
		}
		return checkRings(
			{
				innerRadiusKm: inner,
				outerRadiusKm: outer,
				textures: { alpha, color },
			},
			planetId,
			ctx,
		)
	}

	const external = ctx.options.ringsFor(planetId)
	if (external === null || external === undefined) {
		if (EXTERNAL_RING_PLANETS.includes(planetId)) {
			ctx.warnings.push(
				`${planetId}: no ring data (data/rings/${planetId}.json not found), rings left null`,
			)
		}
		return null
	}
	const parsed = RingsSchema.safeParse(external)
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map((issue) => `${issue.path.map(String).join(".")}: ${issue.message}`)
			.join("; ")
		throw new BuildError(
			`${planetId}: invalid data/rings/${planetId}.json (${issues})`,
		)
	}
	const { innerRadiusKm, outerRadiusKm, textures } = parsed.data
	return checkRings(
		{
			innerRadiusKm,
			outerRadiusKm,
			textures: { alpha: textures.alpha, color: textures.color },
		},
		planetId,
		ctx,
	)
}

const checkRings = (rings: Rings, planetId: string, ctx: Context): Rings => {
	for (const [key, path] of Object.entries(rings.textures)) {
		if (!ctx.options.fileExists(path)) {
			throw new BuildError(
				`${planetId}: ring texture ${key} "${path}" is missing under public/`,
			)
		}
	}
	return rings
}

const buildSun = (raw: Raw, ctx: Context): Body => {
	const name = str(raw.englishName) ?? str(raw.name)
	if (name === null) throw new BuildError("the sun has no name")
	const id = uniqueId(slug(name), null, ctx)
	const radius = radiusOf([raw], null)
	const massKg = parseMass(raw.mass)
	checkDensity(name, massKg, radius.radiusKm, ctx)
	return assemble({
		id,
		name,
		kind: "star",
		parentId: null,
		...radius,
		massKg,
		orbit: null,
		rotation: rotationOf([raw], id),
		textures: resolveTextures(rec(raw.textures), "star", name, ctx),
		rings: null,
		info: infoOf([raw]),
	})
}

const buildPlanet = (raw: Raw, sunId: string, ctx: Context): Body => {
	const name = str(raw.englishName) ?? str(raw.name)
	if (name === null) throw new BuildError("a planet has no name")
	const semiMajorAxisKm =
		positive(num(raw.semimajorAxis)) ?? positive(num(raw.distanceFromParent))
	const periodDays =
		positiveAbs(num(raw.sideralOrbit)) ?? positiveAbs(num(raw.orbitalPeriod))
	if (semiMajorAxisKm === null || periodDays === null) {
		throw new BuildError(`${name}: planet without semi-major axis or period`)
	}
	const id = uniqueId(slug(name), sunId, ctx)
	const orbit: Orbit = {
		semiMajorAxisKm,
		eccentricity: num(raw.eccentricity) ?? 0,
		inclinationDeg: num(raw.inclination) ?? num(raw.orbitalInclination) ?? 0,
		longAscNodeDeg: num(raw.longAscNode) ?? 0,
		argPeriapsisDeg: num(raw.argPeriapsis) ?? 0,
		meanAnomalyDeg: num(raw.mainAnomaly) ?? 0,
		periodDays,
		epochJD: J2000,
	}
	const extraTextures: Partial<Record<TextureKey, string>> =
		id === "earth" && ctx.options.fileExists(EARTH_NIGHT_TEXTURE)
			? { night: EARTH_NIGHT_TEXTURE }
			: {}
	const radius = radiusOf([raw], null)
	const massKg = parseMass(raw.mass)
	checkDensity(name, massKg, radius.radiusKm, ctx)
	return assemble({
		id,
		name,
		kind: "planet",
		parentId: sunId,
		...radius,
		massKg,
		orbit,
		rotation: rotationOf([raw], id),
		textures: resolveTextures(
			rec(raw.textures),
			"planet",
			name,
			ctx,
			extraTextures,
		),
		rings: ringsOf(raw, id, ctx),
		info: infoOf([raw]),
	})
}

/**
 * What the moons of a planet need from it: mass (Kepler), the IAU pole (to rotate
 * equator-relative elements) and the Laplace radius (which moons those are).
 */
const planetInfoOf = (planet: Body, sunMassKg: number | null): PlanetInfo => {
	const { rotation, orbit, massKg } = planet
	const poleEcliptic =
		rotation.poleRaDeg !== undefined && rotation.poleDecDeg !== undefined
			? eclipticDirection(rotation.poleRaDeg, rotation.poleDecDeg)
			: null
	const oblateness = PLANET_OBLATENESS[planet.id]
	const laplace =
		oblateness !== undefined &&
		orbit !== null &&
		massKg !== null &&
		sunMassKg !== null
			? laplaceRadiusKm(
					oblateness.j2,
					oblateness.equatorialRadiusKm,
					orbit.semiMajorAxisKm,
					orbit.eccentricity,
					massKg,
					sunMassKg,
				)
			: null
	return {
		id: planet.id,
		name: planet.name,
		massKg,
		poleEcliptic,
		laplaceRadiusKm: laplace,
	}
}

/**
 * Groups the `moons` (API export) and `satellites` (hand-curated) entries of a planet by
 * normalized English name. API records come first in every group so they win ties.
 */
const collectMoonGroups = (
	planetRaw: Raw,
	planet: PlanetInfo,
	ctx: Context,
): MoonRecord[][] => {
	const groups = new Map<string, MoonRecord[]>()
	const add = (key: string, record: MoonRecord): void => {
		const group = groups.get(key)
		if (group === undefined) {
			groups.set(key, [record])
			return
		}
		if (record.fromSatellites && group.some((g) => g.fromSatellites)) {
			ctx.warnings.push(
				`${planet.name}: duplicate satellites entry "${str(record.raw.name)}", the first one wins`,
			)
		}
		group.push(record)
	}

	for (const raw of records(planetRaw.moons)) {
		if ("ISS" in raw) continue
		const name = str(raw.englishName) ?? str(raw.name)
		if (name === null) {
			ctx.warnings.push(`${planet.name}: skipping a moons entry without a name`)
			continue
		}
		add(normalizeName(name), { raw, fromSatellites: false })
	}
	for (const raw of records(planetRaw.satellites)) {
		const name = str(raw.name)
		if (name === null) {
			ctx.warnings.push(
				`${planet.name}: skipping a satellites entry without a name`,
			)
			continue
		}
		add(normalizeName(name), { raw, fromSatellites: true })
	}

	for (const group of groups.values()) {
		if (!group.some((g) => !g.fromSatellites)) {
			ctx.warnings.push(
				`${planet.name}: satellites entry "${str(group[0].raw.name)}" has no API partner in moons[], using its curated fields`,
			)
		}
	}
	if (groups.size > 0 && planet.poleEcliptic === null) {
		ctx.warnings.push(
			`${planet.name}: no IAU pole, its moons' orbit planes are taken as ecliptic-relative`,
		)
	}
	if (groups.size > 0 && planet.laplaceRadiusKm === null) {
		ctx.warnings.push(
			`${planet.name}: no J2 or mass for a Laplace radius, its moons' orbit planes are taken as ecliptic-relative`,
		)
	}
	return [...groups.values()]
}

const buildMoon = (
	group: MoonRecord[],
	planet: PlanetInfo,
	ctx: Context,
): Body | null => {
	const sources = group.map((g) => g.raw)
	const name =
		first(sources, (raw) => str(raw.englishName)) ??
		first(sources, (raw) => str(raw.name))
	if (name === null) return null
	const label = `${planet.name}/${name}`

	const semiMajorAxisKm =
		first(sources, (raw) => positive(num(raw.semimajorAxis))) ??
		first(sources, (raw) => positive(num(raw.distanceFromParent)))
	if (semiMajorAxisKm === null) {
		ctx.warnings.push(`${label}: skipped, no usable semi-major axis`)
		return null
	}
	// inside the Laplace radius the source inclination refers to the planet's equator
	const isRegular =
		planet.laplaceRadiusKm !== null && semiMajorAxisKm < planet.laplaceRadiusKm

	let periodDerived = false
	let periodDays =
		first(sources, (raw) => positiveAbs(num(raw.sideralOrbit))) ??
		first(sources, (raw) => positiveAbs(parseNumber(raw.orbitalPeriod)))
	if (periodDays === null) {
		if (planet.massKg === null) {
			ctx.warnings.push(
				`${label}: skipped, no usable period and no parent mass`,
			)
			return null
		}
		periodDays = round(periodDaysFromKepler(semiMajorAxisKm, planet.massKg), 4)
		periodDerived = true
		ctx.warnings.push(
			`${label}: no period in the source, derived ${periodDays} d from Kepler's third law`,
		)
	} else if (isRegular && planet.massKg !== null) {
		const kepler = periodDaysFromKepler(semiMajorAxisKm, planet.massKg)
		const deviation = periodDays / kepler - 1
		if (Math.abs(deviation) > KEPLER_PERIOD_TOLERANCE) {
			ctx.warnings.push(
				`${label}: period ${periodDays} d is ${Math.round(100 * Math.abs(deviation))} % ${deviation > 0 ? "longer" : "shorter"} than Kepler's third law gives (${round(kepler, 4)} d)`,
			)
		}
	}

	const id = uniqueId(slug(name), planet.id, ctx)

	let inclinationDeg =
		first(sources, (raw) => num(raw.inclination)) ??
		first(sources, (raw) => num(raw.orbitalInclination)) ??
		0
	let longAscNodeDeg = first(sources, (raw) => num(raw.longAscNode)) ?? 0
	let argPeriapsisDeg = first(sources, (raw) => num(raw.argPeriapsis)) ?? 0
	let meanAnomalyDeg = first(sources, (raw) => num(raw.mainAnomaly)) ?? 0
	const phaseSynthetic =
		longAscNodeDeg === 0 && argPeriapsisDeg === 0 && meanAnomalyDeg === 0
	if (phaseSynthetic) {
		;({ longAscNodeDeg, argPeriapsisDeg, meanAnomalyDeg } = spreadPhases(id))
		if (isRegular && planet.poleEcliptic !== null) {
			// the spread node and periapsis are relative to the equator; rotate all three angles
			const rotated = rotateElementsToEcliptic(
				{ inclinationDeg, longAscNodeDeg, argPeriapsisDeg },
				planet.poleEcliptic,
			)
			inclinationDeg = roundAngle(rotated.inclinationDeg)
			longAscNodeDeg = roundAngle(rotated.longAscNodeDeg)
			argPeriapsisDeg = roundAngle(rotated.argPeriapsisDeg)
			ctx.equatorRotated++
		}
	}

	const orbit: Orbit = {
		semiMajorAxisKm,
		eccentricity: first(sources, (raw) => num(raw.eccentricity)) ?? 0,
		inclinationDeg,
		longAscNodeDeg,
		argPeriapsisDeg,
		meanAnomalyDeg,
		periodDays,
		epochJD: J2000,
		...(phaseSynthetic ? { phaseSynthetic: true } : {}),
		...precessionOf(sources),
	}

	const textureSource =
		group.find((g) => g.fromSatellites && rec(g.raw.textures) !== null) ??
		group.find((g) => rec(g.raw.textures) !== null)
	let textures = resolveTextures(
		textureSource === undefined ? null : rec(textureSource.raw.textures),
		"moon",
		label,
		ctx,
	)
	if (
		textures.base === PLACEHOLDER_TEXTURE &&
		!ownsPlaceholderTexture(planet.id)
	) {
		// curated entries pair the placeholder with the Moon's bump map: not this moon's relief
		textures = { base: PLACEHOLDER_TEXTURE }
	}

	const info = infoOf(sources)
	if (periodDerived) info.periodDerived = true

	const radius = radiusOf(sources, DEFAULT_MOON_RADIUS_KM)
	const massKg = first(sources, (raw) => parseMass(raw.mass))
	checkDensity(label, massKg, radius.radiusKm, ctx)

	return assemble({
		id,
		name,
		kind: "moon",
		parentId: planet.id,
		...radius,
		massKg,
		orbit,
		rotation: rotationOf(sources, id),
		textures,
		rings: null,
		info,
	})
}

/**
 * Curated secular drift of a moon's orbit (the Moon: node regression and apsidal
 * precession, from the Meeus ch. 47 mean elements); both rates or nothing.
 */
const precessionOf = (sources: readonly Raw[]): Pick<Orbit, "precession"> => {
	const nodeDegPerDay = first(sources, (raw) =>
		num(raw.nodePrecessionDegPerDay),
	)
	const argPeriapsisDegPerDay = first(sources, (raw) =>
		num(raw.argPeriapsisPrecessionDegPerDay),
	)
	if (nodeDegPerDay === null || argPeriapsisDegPerDay === null) return {}
	return { precession: { nodeDegPerDay, argPeriapsisDegPerDay } }
}

const statsOf = (
	bodies: Body[],
	planets: Body[],
	equatorRotated: number,
): BuildStats => {
	const perKind: Record<BodyKind, number> = { star: 0, planet: 0, moon: 0 }
	const moonsPerPlanet: Record<string, number> = {}
	for (const planet of planets) moonsPerPlanet[planet.id] = 0
	let radiusEstimated = 0
	let phaseSynthetic = 0
	let periodDerived = 0
	let placeholderTextures = 0
	let rings = 0
	for (const body of bodies) {
		perKind[body.kind]++
		if (body.kind === "moon" && body.parentId !== null) {
			moonsPerPlanet[body.parentId] = (moonsPerPlanet[body.parentId] ?? 0) + 1
		}
		if (body.radiusEstimated) radiusEstimated++
		if (body.orbit?.phaseSynthetic) phaseSynthetic++
		if (body.info.periodDerived === true) periodDerived++
		if (usesPlaceholderTexture(body)) placeholderTextures++
		if (body.rings !== null) rings++
	}
	return {
		total: bodies.length,
		perKind,
		moonsPerPlanet,
		radiusEstimated,
		phaseSynthetic,
		equatorRotated,
		periodDerived,
		placeholderTextures,
		rings,
	}
}

/**
 * Builds the topologically ordered body list: the Sun, the planets by semi-major axis,
 * then each planet's moons (by semi-major axis) grouped right after the planet block.
 */
export const buildBodies = (
	source: unknown,
	options: BuildOptions,
): BuildResult => {
	const db = rec(source)
	if (db === null) throw new BuildError("the source is not a JSON object")
	const suns = records(db.suns)
	if (suns.length !== 1) {
		throw new BuildError(`expected exactly one sun, found ${suns.length}`)
	}
	const ctx: Context = {
		options,
		warnings: [],
		usedIds: new Set(),
		equatorRotated: 0,
	}

	const sun = buildSun(suns[0], ctx)
	const planetEntries = records(db.planets)
		.map((raw) => ({ raw, body: buildPlanet(raw, sun.id, ctx) }))
		.sort((a, b) => byOrbitThenId(a.body, b.body))

	const bodies: Body[] = [sun, ...planetEntries.map((entry) => entry.body)]
	for (const { raw, body } of planetEntries) {
		const planet = planetInfoOf(body, sun.massKg)
		const moons = collectMoonGroups(raw, planet, ctx)
			.map((group) => buildMoon(group, planet, ctx))
			.filter((moon): moon is Body => moon !== null)
			.sort(byOrbitThenId)
		bodies.push(...moons)
	}

	return {
		bodies,
		stats: statsOf(
			bodies,
			planetEntries.map((entry) => entry.body),
			ctx.equatorRotated,
		),
		warnings: ctx.warnings,
	}
}
