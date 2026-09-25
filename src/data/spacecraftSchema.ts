/**
 * Zod schemas of src/data/spacecraft.json (the catalogue) and
 * src/data/spacecraftTrajectories.json (issue #35, docs/ARCHITECTURE.md,
 * "Spacecraft"), written by `pnpm build:spacecraft` from the curated catalogue
 * data/spacecraft.json and trajectories from JPL Horizons.
 *
 * A trajectory is a list of segments. Each segment holds sparse states of the
 * craft relative to one centre (the Sun, or a planet while the craft is in its
 * neighbourhood): times in days from J2000 (UT), positions in km and
 * velocities in km/s in the ecliptic and equinox of J2000, rebuilt between
 * samples by cubic Hermite interpolation (src/sim/hermite.ts). A planet
 * segment with a `blend` hands over smoothly to the Sun's segment between its
 * inner and outer radius (see src/sim/spacecraft.ts).
 */
import { z } from "zod"

/** An instant, UTC: `1977-09-05T12:56Z`. */
const instant = z
	.string()
	.regex(
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/,
		"expected YYYY-MM-DDTHH:MMZ",
	)

export const SPACECRAFT_EVENT_KINDS = [
	"flyby",
	"orbitInsertion",
	"probeLanding",
	"impact",
	"arrival",
	"heliopause",
	"closestToSun",
	"paleBlueDot",
	"farthest",
	"firstImages",
	"lastContact",
	"missionEnd",
] as const

export type SpacecraftEventKind = (typeof SPACECRAFT_EVENT_KINDS)[number]

/**
 * Event targets that are not bodies of src/data/bodies.json; their names are
 * in the locales (`solarSystem.spacecraft.target.<id>`).
 */
export const SPACECRAFT_EXTRA_TARGETS = ["pluto", "arrokoth", "l2"] as const

export const SpacecraftEvent = z
	.object({
		date: instant,
		kind: z.enum(SPACECRAFT_EVENT_KINDS),
		/** A body id, or one of SPACECRAFT_EXTRA_TARGETS. */
		target: z.string().min(1).optional(),
		/** Closest distance to the target's centre, km (flybys of planets; from the trajectory). */
		distanceKm: z.number().positive().optional(),
	})
	.strict()

export const SpacecraftEnd = z
	.object({
		date: instant,
		/** "silent": the craft flies on, no longer heard; "destroyed": it no longer exists (Cassini). */
		kind: z.enum(["silent", "destroyed"]),
	})
	.strict()

export const SpacecraftOrbit = z
	.object({
		/** Body id of the planet orbited. */
		center: z.string().min(1),
		from: instant,
		/** Absent: until the end of the data. */
		to: instant.optional(),
		/** Days of track drawn around the planet on either side of the current time. */
		trackDays: z.number().positive(),
	})
	.strict()

export const TrajectorySegment = z
	.object({
		/** Body id of the centre: "sun" or a planet. */
		center: z.string().min(1),
		/**
		 * [innerKm, outerKm]: inside inner the segment alone places the craft,
		 * beyond outer the Sun's segment does, in between they blend. null: the
		 * segment alone places the craft for its whole time range.
		 */
		blend: z.tuple([z.number().positive(), z.number().positive()]).nullable(),
		/** Days from J2000 (JD - 2451545), UT, strictly ascending. */
		t: z.array(z.number()).min(2),
		/** km, ecliptic J2000, 3 per sample. */
		p: z.array(z.number()),
		/** km/s, ecliptic J2000, 3 per sample. */
		v: z.array(z.number()),
	})
	.strict()
	.refine(
		(segment) =>
			segment.p.length === segment.t.length * 3 &&
			segment.v.length === segment.t.length * 3,
		{ message: "p and v need 3 values per time" },
	)
	.refine(
		(segment) => segment.t.every((t, k) => k === 0 || t > segment.t[k - 1]),
		{
			message: "times must be strictly ascending",
		},
	)

export const Spacecraft = z
	.object({
		/** Stable id: "voyager1"; also the key of its content in src/locales/<locale>/spacecraft.json. */
		id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
		/** The mission's own name, used when a locale has none. */
		name: z.string().min(1),
		/** JPL Horizons target id. */
		horizonsId: z.string().min(1),
		launch: instant,
		/** The trajectory covers [dataFrom, dataTo]. */
		dataFrom: instant,
		dataTo: instant,
		/** null while the mission is operating. */
		end: SpacecraftEnd.nullable(),
		events: z.array(SpacecraftEvent),
		orbits: z.array(SpacecraftOrbit),
	})
	.strict()

export const SpacecraftFile = z
	.object({
		/** Where the data comes from, how it was sampled, how accurate it is. */
		source: z
			.object({
				name: z.string(),
				url: z.string(),
				frame: z.string(),
				timeScale: z.string(),
				fetched: z.string(),
				tolerance: z.string(),
			})
			.strict(),
		/** Events after this date are plans; trajectories after it are predictions. */
		asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		craft: z.array(Spacecraft).min(1),
	})
	.strict()

/**
 * src/data/spacecraftTrajectories.json: craft id -> trajectory segments. Kept
 * apart from the catalogue because it is large; the app loads it on demand.
 */
export const TrajectoriesFile = z.record(
	z.string(),
	z.array(TrajectorySegment).min(1),
)

export type SpacecraftEvent = z.infer<typeof SpacecraftEvent>
export type SpacecraftEnd = z.infer<typeof SpacecraftEnd>
export type SpacecraftOrbit = z.infer<typeof SpacecraftOrbit>
export type TrajectorySegment = z.infer<typeof TrajectorySegment>
export type Spacecraft = z.infer<typeof Spacecraft>
export type SpacecraftFile = z.infer<typeof SpacecraftFile>
export type TrajectoriesFile = z.infer<typeof TrajectoriesFile>
