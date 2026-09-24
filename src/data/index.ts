/**
 * Typed access to the generated solar system data.
 *
 * src/data/bodies.json is produced by `pnpm build:data` (scripts/build-bodies.ts) and is
 * already validated there, so it is cast here rather than parsed again at module load.
 * src/data/bodies.test.ts re-validates the committed file with the zod schema.
 */
import type { Body } from "./schema"

import bodiesJson from "./bodies.json"

export type {
	BodiesFile,
	Body,
	BodyKind,
	BodyTextures,
	Orbit,
	Rings,
	Rotation,
} from "./schema"

/** Every body in topological order: the Sun, the planets by distance, then each planet's moons. */
export const bodies: Body[] = bodiesJson as Body[]

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
