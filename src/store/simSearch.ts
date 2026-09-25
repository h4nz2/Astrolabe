/**
 * Search params of `/solar_system?focus=io&at=<x_y_z>&sel=europa&frame=io&cam=<az_el_dist>&t=<jd>&warp=<n>&moons=false&scale=trueScale`
 * (the layer switches `orbits`, `labels`, `moons`, `markers` alike; `paused`,
 * `present`, `contrast` for #29).
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

const layerSwitch = z.boolean().optional().catch(undefined)

export const simSearchSchema = z.object({
	// focused body id (absent: the overview); unknown ids are ignored when applied (see urlSync.ts)
	focus: z.string().optional().catch(undefined),
	// a free centre (#15): the offset from `focus` in its true radii, `x_y_z` (see formatOffset in navigation.ts)
	at: z.string().optional().catch(undefined),
	// selected body id when it is not the focused body
	sel: z.string().optional().catch(undefined),
	// the body held still (#31): the frame is anchored to the focus (absent: Sun-centred)
	frame: z.string().optional().catch(undefined),
	// camera around the view, `azimuth_elevation_distance` (see formatShot in navigation.ts)
	cam: z.string().optional().catch(undefined),
	// simulation time as a Julian Date (zod 4 already rejects NaN and +-Infinity)
	t: z.preprocess(urlNumber, z.coerce.number().optional()).catch(undefined),
	// simulated seconds per real second; negative runs the clock backwards,
	// 0 is dropped (pausing is its own state and never reaches the URL)
	warp: z
		.preprocess(
			urlNumber,
			z.coerce
				.number()
				.refine((warp) => warp !== 0)
				.optional(),
		)
		.catch(undefined),
	// the layer switches (LAYER_PARAMS in urlSync.ts); only `false` is ever
	// written, on is the default
	orbits: layerSwitch,
	labels: layerSwitch,
	moons: layerSwitch,
	markers: layerSwitch,
	// orbit names (#20) are off by default, so only `true` is ever written
	orbitNames: layerSwitch,
	// the scale preset (#21), a preset id of src/sim/scale.ts; absent is the
	// default (Everything visible), unknown ids are ignored when applied
	scale: z.string().optional().catch(undefined),
	// `?birthday=true` opens the birthday panel (#26) on arrival; it is only an
	// instruction and never carries a date (a birth date never enters the URL)
	birthday: z.boolean().optional().catch(undefined),
	// presentation mode (#29): `present=true` opens in projector mode,
	// `contrast=high` with high contrast, `paused=true` with the clock stopped
	// (see src/store/presentation.ts); only the non-default value is written
	present: layerSwitch,
	contrast: z.enum(["high"]).optional().catch(undefined),
	paused: layerSwitch,
})

export type SimSearch = z.output<typeof simSearchSchema>
