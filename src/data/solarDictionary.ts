/**
 * Adapter that replaces the old GraphQL `solarDictionary` query.
 *
 * Phase 1 projects the Sun and the eight planets straight out of data/ourDB.json,
 * mirroring graphql/services/getAllSolarDictionaryItems.ts + the demoEntity key list.
 * Phase 2 will source the same shape from src/data/bodies.json (see docs/ARCHITECTURE.md).
 * Texture paths are root-absolute in the source and are resolved through assetUrl() here,
 * so they honour VITE_BASE.
 */
import { useMemo } from "react"

import { assetUrl } from "@/utils/assetUrl"

import ourDB from "../../data/ourDB.json"
import type { OurDatabase, PlanetsEntity, SunsEntity } from "../../data/ourDB"

// Same fields and nullability as the old generated/schema.graphql types.
export type Mass = { massValue: number; massExponent: number }

export type MajorElementsEntity = {
	abbr: string
	element: string
	percentageOfComposition: number
}

export type Composition = {
	majorElements: Array<MajorElementsEntity | null> | null
}

export type Textures = {
	base: string
	topo: string | null
	specular: string | null
	clouds: string | null
}

export type SolarDictionaryItem = {
	id: number
	name: string
	diameter: number
	lengthOfDay: number | null
	dimension: number | null
	mass: Mass | null
	gravity: number | null
	density: number | null
	avgTemp: string | null
	composition: Composition | null
	textures: Textures | null
	orbitalPeriod: number | null
	orbitalVelocity: number | null
	orbitalInclination: number | null
	orbitPositionOffset: number | null
	axialTilt: number | null
	discoveredBy: string | null
	discoveryDate: string | null
	alternativeName: string | null
	perihelion: number | null
	aphelion: number | null
	semimajorAxis: number | null
	eccentricity: number | null
}

export const SUN_ID = 0

type SourceEntity = SunsEntity | PlanetsEntity

// Suns and planets differ in which fields they carry; read them loosely and
// coerce exactly like the GraphQL Float/String scalars did.
const field = (entity: SourceEntity, key: string): unknown =>
	(entity as unknown as Record<string, unknown>)[key]

const num = (value: unknown): number | null =>
	typeof value === "number" && Number.isFinite(value) ? value : null

const str = (value: unknown): string | null =>
	value === undefined || value === null ? null : String(value)

const mass = (value: unknown): Mass | null => {
	if (!value || typeof value !== "object") return null
	const { massValue, massExponent } = value as Partial<Mass>
	return typeof massValue === "number" && typeof massExponent === "number"
		? { massValue, massExponent }
		: null
}

const composition = (value: unknown): Composition | null => {
	if (!value || typeof value !== "object") return null
	const { majorElements } = value as { majorElements?: unknown }
	return {
		majorElements: Array.isArray(majorElements)
			? majorElements.map((element): MajorElementsEntity | null =>
					element && typeof element === "object"
						? (element as MajorElementsEntity)
						: null,
				)
			: null,
	}
}

const url = (value: unknown): string | null => {
	const path = str(value)
	return path === null ? null : assetUrl(path)
}

const textures = (value: unknown): Textures | null => {
	if (!value || typeof value !== "object") return null
	const { base, topo, specular, clouds } = value as Partial<
		Record<keyof Textures, unknown>
	>
	if (typeof base !== "string") return null
	return {
		base: assetUrl(base),
		topo: url(topo),
		specular: url(specular),
		clouds: url(clouds),
	}
}

const project = (entity: SourceEntity): SolarDictionaryItem => ({
	id: entity.id,
	name: entity.name,
	diameter: entity.diameter,
	lengthOfDay: num(field(entity, "lengthOfDay")),
	dimension: num(field(entity, "dimension")),
	mass: mass(field(entity, "mass")),
	gravity: num(field(entity, "gravity")),
	density: num(field(entity, "density")),
	avgTemp: str(field(entity, "avgTemp")),
	composition: composition(field(entity, "composition")),
	textures: textures(field(entity, "textures")),
	orbitalPeriod: num(field(entity, "orbitalPeriod")),
	orbitalVelocity: num(field(entity, "orbitalVelocity")),
	orbitalInclination: num(field(entity, "orbitalInclination")),
	orbitPositionOffset: num(field(entity, "orbitPositionOffset")),
	axialTilt: num(field(entity, "axialTilt")),
	discoveredBy: str(field(entity, "discoveredBy")),
	discoveryDate: str(field(entity, "discoveryDate")),
	alternativeName: str(field(entity, "alternativeName")),
	perihelion: num(field(entity, "perihelion")),
	aphelion: num(field(entity, "aphelion")),
	semimajorAxis: num(field(entity, "semimajorAxis")),
	eccentricity: num(field(entity, "eccentricity")),
})

const db = ourDB as unknown as OurDatabase

/** Sun first (id 0), then the eight planets ordered by id (1 = Mercury ... 8 = Neptune). */
export const solarDictionary: SolarDictionaryItem[] = [
	...db.suns.map(project),
	...db.planets.map(project),
]

export type SolarDictionaryArgs = {
	ids?: number[] | null
	names?: string[] | null
}

/**
 * Mirrors the old `solarDictionary(ids, names)` resolver: no args returns everything,
 * otherwise items matched by id (0 = Sun) followed by items matched by name
 * (case-insensitive substring; anything containing "sun" is the Sun).
 */
export const getSolarDictionaryItems = ({
	ids,
	names,
}: SolarDictionaryArgs = {}): SolarDictionaryItem[] => {
	if (!ids?.length && !names?.length) return solarDictionary

	const [sun, ...planets] = solarDictionary

	const byId = (ids ?? []).flatMap((id) =>
		id === SUN_ID ? [sun] : planets.filter((planet) => planet.id === id),
	)
	const byName = (names ?? []).flatMap((name) =>
		/sun/i.test(name)
			? [sun]
			: planets.filter((planet) =>
					planet.name.toLowerCase().includes(name.toLowerCase()),
				),
	)

	return [...byId, ...byName]
}

/** Drop-in for the old `useSolarDictionaryQuery`: `data` is the item array, `loading` is always false. */
export const useSolarDictionary = (args?: SolarDictionaryArgs) => {
	const key = args ? JSON.stringify(args) : ""
	const data = useMemo(
		() =>
			getSolarDictionaryItems(
				key ? (JSON.parse(key) as SolarDictionaryArgs) : undefined,
			),
		[key],
	)
	return { data, loading: false as const }
}
