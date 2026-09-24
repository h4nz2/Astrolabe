/**
 * Search params of `/solar_system?focus=io&sel=europa&cam=<az_el_dist>&t=<jd>&warp=<n>`.
 *
 * Kept free of app imports (only zod) because the route module that validates
 * the URL is loaded eagerly with the route tree; the store and the data stay in
 * the page's code-split chunk. Invalid values fall back to "absent" instead of
 * breaking the page, like the dictionary route does.
 */
import { z } from "zod"

/**
 * What may become a URL number: numbers (the router already JSON-parses
 * numeric params) and non-blank strings. Everything else (`?t=`, `?t=null`,
 * `?t=true`) is absent; `z.coerce` alone would turn those into 0 or 1.
 */
const urlNumber = (value: unknown): unknown =>
	typeof value === "number" ||
	(typeof value === "string" && value.trim() !== "")
		? value
		: undefined

export const simSearchSchema = z.object({
	// focused body id (absent: the overview); unknown ids are ignored when applied (see urlSync.ts)
	focus: z.string().optional().catch(undefined),
	// selected body id when it is not the focused body
	sel: z.string().optional().catch(undefined),
	// camera around the view, `azimuth_elevation_distance` (see formatShot in navigation.ts)
	cam: z.string().optional().catch(undefined),
	// simulation time as a Julian Date (zod 4 already rejects NaN and +-Infinity)
	t: z.preprocess(urlNumber, z.coerce.number().optional()).catch(undefined),
	// simulated seconds per real second
	warp: z
		.preprocess(urlNumber, z.coerce.number().positive().optional())
		.catch(undefined),
})

export type SimSearch = z.output<typeof simSearchSchema>
