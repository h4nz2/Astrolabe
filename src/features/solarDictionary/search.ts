/**
 * Search params of `/solar_dictionary?entity=3&texture=topo`; defaults (the
 * Sun, base) are omitted from the URL and anything invalid falls back to them
 * instead of throwing. Only zod and a type import: the route module is eager.
 */
import { z } from "zod"

import type { Textures } from "@/data/solarDictionary"

// type-only link to the adapter so the JSON data stays out of this eager route chunk
const textureKeys = [
	"base",
	"topo",
	"specular",
	"clouds",
] as const satisfies readonly (keyof Textures)[]

export const dictionarySearchSchema = z.object({
	entity: z.number().int().min(0).max(8).optional().catch(undefined),
	texture: z.enum(textureKeys).optional().catch(undefined),
})
