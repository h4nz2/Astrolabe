/**
 * Zod schemas for src/data/bodies.json. This is the data model from docs/ARCHITECTURE.md;
 * the TypeScript types are inferred from the schemas, never declared twice.
 *
 * The build (`pnpm build:data`, scripts/build-bodies.ts) validates its output with
 * `BodiesFile` before writing; the app casts the JSON and src/data/bodies.test.ts
 * re-validates it, so module load stays cheap.
 */
import { z } from "zod"

export const BodyKind = z.enum(["star", "planet", "moon"])

export const Orbit = z.object({
	semiMajorAxisKm: z.number().positive(),
	eccentricity: z.number().min(0).lt(1),
	/**
	 * To the ecliptic. Moons with synthetic phases inside their planet's Laplace radius had the
	 * source's equator-relative inclination rotated into the ecliptic by the build (parent IAU pole).
	 */
	inclinationDeg: z.number(),
	longAscNodeDeg: z.number(),
	argPeriapsisDeg: z.number(),
	/** at epochJD */
	meanAnomalyDeg: z.number(),
	/** sidereal orbital period */
	periodDays: z.number().positive(),
	/** 2451545.0 (J2000) for all source data */
	epochJD: z.number(),
	/** true when node, periapsis and anomaly were all 0 in the source and were spread from hash(id) */
	phaseSynthetic: z.boolean().optional(),
	/**
	 * Secular drift of the orbit's orientation in degrees per day (the Moon: its node regresses
	 * once in 18.6 years, its perigee advances once in 8.85). `periodDays` stays the sidereal
	 * period of the mean longitude; see `orbitAt` in src/sim/kepler.ts.
	 */
	precession: z
		.object({
			nodeDegPerDay: z.number(),
			argPeriapsisDegPerDay: z.number(),
		})
		.optional(),
})

export const BodyTextures = z.object({
	base: z.string().min(1),
	topo: z.string().min(1).optional(),
	specular: z.string().min(1).optional(),
	clouds: z.string().min(1).optional(),
	night: z.string().min(1).optional(),
})

/**
 * Curated presentation hints beside the textures (#17): `tint`, an sRGB "#rrggbb" the colour
 * map is multiplied with, and `veiled`, an opaque haze hides the surface in visible light, so
 * only the tint is drawn. Since #37 every moon has its own map with its colours baked in, so
 * no moon uses either; they remain for bodies that need them. `color` (#37) is the map's mean
 * colour, drawn until the map has loaded (maps load only when the body is near, see
 * "Moon surfaces" in docs/ARCHITECTURE.md).
 */
export const Appearance = z.object({
	tint: z
		.string()
		.regex(/^#[0-9a-f]{6}$/)
		.optional(),
	veiled: z.literal(true).optional(),
	color: z
		.string()
		.regex(/^#[0-9a-f]{6}$/)
		.optional(),
})

/**
 * Where a moon's surface map comes from (#37, data/moon-surfaces.json): `map` is a real
 * spacecraft map, `painted` a surface painted from what is known (colour, brightness, the kind
 * of terrain) because no spacecraft has mapped the moon, `haze` Titan's haze as seen in visible
 * light. `filled`: part of a real map was never photographed and is filled in to match.
 * `source` is the id of its entry in src/data/credits.json. The Sun and the planets carry one
 * too (data/planet-textures.json): `painted` for cloud bands painted after spacecraft photos,
 * `haze` for Venus, whose clouds hide the ground.
 */
export const Surface = z.object({
	kind: z.enum(["map", "painted", "haze"]),
	source: z.string().min(1),
	filled: z.literal(true).optional(),
})

/**
 * One image source with its credit and licence (src/data/credits.json, built from
 * data/planet-textures.json and data/moon-surfaces.json). The help page (#43) lists these; `bodies` are the ids that show it.
 */
export const ImageCredit = z.object({
	id: z.string().min(1),
	kind: z.enum(["map", "painted"]),
	title: z.string().min(1),
	credit: z.string().min(1),
	short: z.string().min(1),
	url: z.string().min(1),
	licence: z.string().min(1),
	licenceUrl: z.string().min(1),
	note: z.string().min(1).optional(),
	bodies: z.array(z.string().min(1)).min(1),
})
export const CreditsFile = z.array(ImageCredit)

export const Rings = z
	.object({
		innerRadiusKm: z.number().positive(),
		outerRadiusKm: z.number().positive(),
		textures: z.object({
			alpha: z.string().min(1),
			color: z.string().min(1),
		}),
	})
	.refine((rings) => rings.outerRadiusKm > rings.innerRadiusKm, {
		message: "outerRadiusKm must be larger than innerRadiusKm",
		path: ["outerRadiusKm"],
	})

/**
 * Spin: `periodHours` alone carries the direction (negative = retrograde), `axialTiltDeg` is the
 * obliquity to the body's own orbit measured to the IAU north pole (0..90). The Sun, the planets
 * and the Moon also carry the IAU 2015 north pole (ICRF right ascension / declination) and the
 * prime meridian angle W0 at J2000; see src/sim/rotation.ts for how they are used. `synchronous`
 * marks a tidally locked moon (its period then equals its orbital period).
 */
export const Rotation = z
	.object({
		periodHours: z.number().nullable(),
		axialTiltDeg: z.number().min(0).max(90),
		poleRaDeg: z.number().optional(),
		poleDecDeg: z.number().min(-90).max(90).optional(),
		primeMeridianDeg: z.number().optional(),
		/** tidally locked: the prime meridian faces the parent (src/sim/rotation.ts synchronousAngle) */
		synchronous: z.literal(true).optional(),
	})
	.refine(
		(rotation) =>
			(rotation.poleRaDeg === undefined) ===
			(rotation.poleDecDeg === undefined),
		{
			message: "poleRaDeg and poleDecDeg come together",
			path: ["poleDecDeg"],
		},
	)

export const Body = z
	.object({
		/** unique slug: "sun", "earth", "moon", "io", "s2003j24" */
		id: z.string().regex(/^[a-z0-9]+$/),
		/** English display name */
		name: z.string().min(1),
		kind: BodyKind,
		/** null only for the Sun */
		parentId: z.string().nullable(),
		/** mean radius; derived from a diameter or a default when radiusEstimated is true */
		radiusKm: z.number().positive(),
		radiusEstimated: z.boolean().optional(),
		massKg: z.number().positive().nullable(),
		/** null only for the Sun */
		orbit: Orbit.nullable(),
		rotation: Rotation,
		textures: BodyTextures,
		appearance: Appearance.optional(),
		/** where the body's surface picture comes from (#37 for moons, data/planet-textures.json) */
		surface: Surface.optional(),
		rings: Rings.nullable(),
		/** dictionary fields passed through from the source */
		info: z.record(z.string(), z.unknown()),
		/**
		 * A moon with a story (data/featured-moons.json, #17): shown by default. Every other moon is
		 * the long tail, drawn only while the viewer asks for all moons (docs/ARCHITECTURE.md, "Moons").
		 */
		featured: z.literal(true).optional(),
	})
	.superRefine((body, ctx) => {
		if ((body.kind === "star") !== (body.parentId === null)) {
			ctx.addIssue({
				code: "custom",
				message: "parentId must be null exactly for the star",
				path: ["parentId"],
			})
		}
		if ((body.kind === "star") !== (body.orbit === null)) {
			ctx.addIssue({
				code: "custom",
				message: "orbit must be null exactly for the star",
				path: ["orbit"],
			})
		}
		if (body.featured && body.kind !== "moon") {
			ctx.addIssue({
				code: "custom",
				message: "only moons are featured; every other body is always shown",
				path: ["featured"],
			})
		}
		if (body.kind === "planet" && body.orbit?.phaseSynthetic) {
			ctx.addIssue({
				code: "custom",
				message: "planets carry real J2000 elements, never synthetic phases",
				path: ["orbit", "phaseSynthetic"],
			})
		}
	})

/** The whole bodies.json: topological order, the star first, unique ids. */
export const BodiesFile = z.array(Body).superRefine((bodies, ctx) => {
	const seen = new Set<string>()
	bodies.forEach((body, index) => {
		if (seen.has(body.id)) {
			ctx.addIssue({
				code: "custom",
				message: `duplicate id "${body.id}"`,
				path: [index, "id"],
			})
		}
		if (body.parentId !== null && !seen.has(body.parentId)) {
			ctx.addIssue({
				code: "custom",
				message: `parent "${body.parentId}" must appear before "${body.id}"`,
				path: [index, "parentId"],
			})
		}
		seen.add(body.id)
	})
	const stars = bodies.filter((body) => body.kind === "star")
	if (stars.length !== 1 || bodies[0]?.kind !== "star") {
		ctx.addIssue({
			code: "custom",
			message: "exactly one star is expected and it must come first",
			path: [0, "kind"],
		})
	}
})

export type BodyKind = z.infer<typeof BodyKind>
export type Orbit = z.infer<typeof Orbit>
export type BodyTextures = z.infer<typeof BodyTextures>
export type Appearance = z.infer<typeof Appearance>
export type Surface = z.infer<typeof Surface>
export type ImageCredit = z.infer<typeof ImageCredit>
export type Rotation = z.infer<typeof Rotation>
export type Rings = z.infer<typeof Rings>
export type Body = z.infer<typeof Body>
export type BodiesFile = z.infer<typeof BodiesFile>
