/**
 * Typed access to the generated solar system data.
 *
 * src/data/bodies.json is produced by `pnpm build:data` (scripts/build-bodies.ts) and is
 * already validated there, so it is cast here rather than parsed again at module load.
 * src/data/bodies.test.ts re-validates the committed file with the zod schema.
 */
import type { Body, ImageCredit } from "./schema"

import bodiesJson from "./bodies.json"
import creditsJson from "./credits.json"

export type {
	Appearance,
	BodiesFile,
	Body,
	BodyKind,
	BodyTextures,
	ImageCredit,
	Orbit,
	Rings,
	Rotation,
	Surface,
} from "./schema"

/** Every body in topological order: the Sun, the planets by distance, then each planet's moons. */
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
