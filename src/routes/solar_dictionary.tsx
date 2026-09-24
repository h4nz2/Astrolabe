import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import type { Textures } from "@/data/solarDictionary"
import SolarDictionary from "@/features/solarDictionary"

// type-only link to the adapter so the JSON data stays out of this eager route chunk
const textureKeys = [
	"base",
	"topo",
	"specular",
	"clouds",
] as const satisfies readonly (keyof Textures)[]

// `/solar_dictionary?entity=3&texture=topo`; defaults (Sun, base) are omitted from the URL
// and anything invalid falls back to them instead of throwing.
const searchSchema = z.object({
	entity: z.number().int().min(0).max(8).optional().catch(undefined),
	texture: z.enum(textureKeys).optional().catch(undefined),
})

export const Route = createFileRoute("/solar_dictionary")({
	validateSearch: searchSchema,
	component: SolarDictionary,
})
