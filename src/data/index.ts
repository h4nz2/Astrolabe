/**
 * Typed access to the generated solar system data.
 *
 * src/data/bodies.json is produced by `pnpm build:data` (scripts/build-bodies.ts) and is
 * already validated there, so it is cast here rather than parsed again at module load.
 * src/data/bodies.test.ts re-validates the committed file with the zod schema.
 */
import {
	SMALL_BODY_KINDS,
	type Belt,
	type Body,
	type ImageCredit,
} from "./schema"

import beltsJson from "./belts.json"
import bodiesJson from "./bodies.json"
import creditsJson from "./credits.json"

export { SMALL_BODY_KINDS } from "./schema"
export type {
	Appearance,
	Belt,
	BeltZone,
	BodiesFile,
	Body,
	BodyKind,
	BodyTextures,
	ImageCredit,
	Orbit,
	Rings,
	Rotation,
	Surface,
	Tail,
} from "./schema"

/**
 * Every body in topological order: the Sun, the planets by distance, each planet's moons,
 * then the small bodies (#23: dwarf planets, asteroids, comets) and the dwarf planets' moons.
 */
export const bodies: Body[] = bodiesJson as Body[]

/**
 * Every image source in use, with its credit and licence (#37; built from
 * data/moon-surfaces.json by `pnpm build:data`). For the help page's credits (#43) and the
 * "Surface map" line on a moon's card. `bodies` lists the ids that show each source.
 */
export const imageCredits: ImageCredit[] = creditsJson as ImageCredit[]

export const creditById: Map<string, ImageCredit> = new Map(
	imageCredits.map((credit) => [credit.id, credit]),
)

export const bodyById: Map<string, Body> = new Map(
	bodies.map((body) => [body.id, body]),
)

const childrenById = new Map<string, Body[]>()
for (const body of bodies) {
	if (body.parentId === null) continue
	const siblings = childrenById.get(body.parentId)
	if (siblings === undefined) childrenById.set(body.parentId, [body])
	else siblings.push(body)
}

/** The body with this id; throws for unknown ids (use `bodyById.get` for a soft lookup). */
export const getBody = (id: string): Body => {
	const body = bodyById.get(id)
	if (body === undefined) throw new Error(`Unknown body id "${id}"`)
	return body
}

/** Direct children (planets of the Sun, moons of a planet) in orbital order; a fresh array each call. */
export const childrenOf = (id: string): Body[] => [
	...(childrenById.get(id) ?? []),
]

export const planets: Body[] = bodies.filter((body) => body.kind === "planet")

/** A planet's moons in orbital order (empty for ids that are not planets). */
export const moonsOf = (planetId: string): Body[] =>
	childrenOf(planetId).filter((body) => body.kind === "moon")

const star = bodies.find((body) => body.kind === "star")
if (star === undefined) throw new Error("bodies.json has no star")

export const sun: Body = star

/** The belts (#23): fields of dots, not bodies (src/data/belts.json). */
export const belts: Belt[] = beltsJson as Belt[]

/** Dwarf planets, asteroids and comets, each group in orbital order. */
export const dwarfPlanets: Body[] = bodies.filter(
	(body) => body.kind === "dwarfPlanet",
)
export const asteroids: Body[] = bodies.filter(
	(body) => body.kind === "asteroid",
)
export const comets: Body[] = bodies.filter((body) => body.kind === "comet")

/**
 * Whether a body belongs to the "Small bodies" layer (#23): a dwarf planet, an asteroid or a
 * comet, or a moon of one (Charon). Unknown parents count as not small.
 */
export const isSmallBody = (body: Pick<Body, "kind" | "parentId">): boolean => {
	if (SMALL_BODY_KINDS.includes(body.kind)) return true
	if (body.kind !== "moon" || body.parentId === null) return false
	const parent = bodyById.get(body.parentId)
	return parent !== undefined && SMALL_BODY_KINDS.includes(parent.kind)
}
