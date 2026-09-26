/**
 * The texture catalogue of the Sun and the planets (data/planet-textures.json): every image
 * under public/ that is not a moon's surface (#37) or a ring strip (#12), with the source it
 * is made from, its licence and how `pnpm gen:surfaces` makes it. Pure; the build uses it to
 * credit each texture in src/data/credits.json and to tell the card where a planet's picture
 * comes from (`Body.surface`). See docs/ARCHITECTURE.md, "Planet textures".
 */
import { z } from "zod"

import type { Body, ImageCredit } from "../../src/data/schema"

import type { BandedRecipe } from "./paint"
import {
	creditsOf,
	Recipe,
	resolveSurfaces,
	Source,
	type SurfaceCatalogue,
} from "./surfaces"

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i)

/** How a real map is read and processed. */
export const MapProcess = z
	.object({
		/**
		 * image: the whole file (JPEG, PNG, TIFF) · tiff: one overview page of a large TIFF read
		 * over byte ranges · fits: a FITS image (the Sun) · isis: an ISIS 3 cube (USGS)
		 */
		format: z.enum(["image", "tiff", "fits", "isis"]).default("image"),
		/** east longitude at the horizontal centre of the source image (0 or 180) */
		centreLonEast: z.union([z.literal(0), z.literal(180)]),
		/** colours as published, only resized and turned */
		keep: z.literal(true).optional(),
		/**
		 * with `keep`: every channel raised to this power (under 1 lifts the darks, so a deep
		 * ocean stays readable on a projector; the moons' brightness is compressed the same way)
		 */
		gamma: z.number().positive().max(1).optional(),
		/**
		 * with `keep`: red, green and blue gains, a white balance for a published colour that is
		 * off (the NASA Ames Mars colours are too blue for Mars's butterscotch)
		 */
		balance: z
			.tuple([
				z.number().positive(),
				z.number().positive(),
				z.number().positive(),
			])
			.optional(),
		/** a grey source is coloured from `darkHue` (dark) to `hue` (bright) */
		hue: Hex.optional(),
		darkHue: Hex.optional(),
		/** geometric albedo: sets the mean brightness (as for the moons) */
		albedo: z.number().positive().max(1.5).optional(),
		/** mean brightness 0..1 instead of an albedo (the Sun, which shines by itself) */
		level: z.number().positive().max(1).optional(),
		/** values raised to this power first (under 1 tames a huge range: the Sun) */
		power: z.number().positive().max(2).optional(),
		/** the source has no-data areas (black or blank) that must be filled in to match */
		fill: z.literal(true).optional(),
		/** latitudes beyond this (degrees, north and south) were not seen: mirrored in from below it */
		maxLat: z.number().positive().max(90).optional(),
		/** the map's left and right edges do not meet (built over time): blend them */
		seam: z.literal(true).optional(),
		/** a mask: white where the grey source is at most this (0..1), black elsewhere */
		below: z.number().min(0).max(1).optional(),
	})
	.refine(
		(map) =>
			[
				map.keep === true,
				map.hue !== undefined,
				map.below !== undefined,
			].filter(Boolean).length === 1,
		{ message: "a map is kept (keep), coloured (hue) or a mask (below)" },
	)
	.refine(
		(map) =>
			map.hue === undefined ||
			(map.albedo === undefined) !== (map.level === undefined),
		{ message: "a coloured map needs an albedo or a level, not both" },
	)
export type MapProcess = z.infer<typeof MapProcess>

const Spot = z.object({
	lat: z.number().min(-90).max(90),
	lon: z.number().min(-180).max(180),
	width: z.number().positive(),
	height: z.number().positive(),
	colour: Hex,
	opacity: z.number().min(0).max(1),
})

export const Banded = z.object({
	bands: z
		.array(z.tuple([z.number().min(-90).max(90), Hex]))
		.min(2)
		.refine(
			(bands) =>
				bands.every((band, i) => i === 0 || band[0] <= bands[i - 1][0]),
			{ message: "band stops run from north to south" },
		),
	turbulence: z.number().min(0).max(1),
	spots: z.array(Spot).optional(),
}) satisfies z.ZodType<BandedRecipe>

export const TextureEntry = z
	.object({
		source: z.string().min(1),
		/** output width in px; the height is half */
		width: z.union([
			z.literal(512),
			z.literal(1024),
			z.literal(2048),
			z.literal(4096),
		]),
		map: MapProcess.optional(),
		/** painted: a moon-style recipe (cratered, smooth, haze) or cloud bands */
		painted: z
			.union([z.object({ recipe: Recipe }), z.object({ bands: Banded })])
			.optional(),
		/** what a painted texture rests on */
		basis: z.string().min(1).optional(),
		/** clouds or haze hide the ground in visible light (Venus): the card says so */
		veiled: z.literal(true).optional(),
		/** who uses it, when that is not the Sun or a planet (a texture kept for another issue) */
		for: z.string().min(1).optional(),
	})
	.refine(
		(entry) => (entry.map === undefined) !== (entry.painted === undefined),
		{
			message: "a texture is either a map or painted",
		},
	)
	.refine((entry) => entry.painted === undefined || entry.basis !== undefined, {
		message: "a painted texture needs a basis",
	})
export type TextureEntry = z.infer<typeof TextureEntry>

export const TextureCatalogue = z.object({
	$comment: z.string().optional(),
	sources: z.record(z.string(), Source),
	/** public path ("/assets/textures/...") -> how it is made */
	textures: z.record(
		z.string().regex(/^\/assets\/textures\/.+\.jpg$/),
		TextureEntry,
	),
})
export type TextureCatalogue = z.infer<typeof TextureCatalogue>

/**
 * Validates the catalogue; `extraSources` are the moon catalogue's (a texture may be painted
 * with the moons' painted source). Throws on a malformed file or an unknown source.
 */
export const resolveTextures = (
	raw: unknown,
	extraSources: SurfaceCatalogue["sources"] = {},
): TextureCatalogue => {
	const parsed = TextureCatalogue.safeParse(raw)
	if (!parsed.success) {
		const issue = parsed.error.issues[0]
		throw new Error(
			`data/planet-textures.json: ${issue.path.map(String).join(".")}: ${issue.message}`,
		)
	}
	const catalogue = parsed.data
	for (const [path, entry] of Object.entries(catalogue.textures)) {
		if (
			catalogue.sources[entry.source] === undefined &&
			extraSources[entry.source] === undefined
		) {
			throw new Error(
				`data/planet-textures.json: "${path}" uses the unknown source "${entry.source}"`,
			)
		}
	}
	return catalogue
}

/** What the card says about a texture: a real map, painted, or clouds/haze hiding the ground. */
export const surfaceKind = (entry: TextureEntry): "map" | "painted" | "haze" =>
	entry.veiled === true ||
	(entry.painted !== undefined &&
		"recipe" in entry.painted &&
		entry.painted.recipe.pattern === "haze")
		? "haze"
		: entry.painted === undefined
			? "map"
			: "painted"

const TEXTURE_SLOTS = ["base", "topo", "specular", "clouds", "night"] as const

/**
 * Credits every texture of the Sun and the planets (and of any other body whose texture is in
 * the catalogue) and gives the Sun and the planets their `surface` (from the base texture), in
 * place. A Sun or planet texture missing from the catalogue stops the build: every image the
 * app ships must say where it comes from. Other bodies' textures are left alone.
 *
 * Returns the credits of the textures, then the moons' `moonCredits`, one entry per source
 * (a source both use lists the bodies of both).
 */
export const applyPlanetTextures = (
	bodies: Body[],
	raw: unknown,
	moonCatalogue: unknown,
	moonCredits: ImageCredit[],
): ImageCredit[] => {
	const moonSources =
		moonCatalogue === undefined
			? {}
			: resolveSurfaces(moonCatalogue).catalogue.sources
	const catalogue = resolveTextures(raw, moonSources)
	const usage: { bodyId: string; sourceId: string }[] = []
	bodies.forEach((body, i) => {
		if (body.kind === "moon") return
		const strict = body.kind === "star" || body.kind === "planet"
		const seen = new Set<string>()
		for (const slot of TEXTURE_SLOTS) {
			const path = body.textures[slot]
			if (path === undefined) continue
			const entry = catalogue.textures[path]
			if (entry === undefined) {
				if (strict) {
					throw new Error(
						`${body.id}: texture ${slot} "${path}" is not in data/planet-textures.json (every texture needs a source and licence)`,
					)
				}
				continue
			}
			if (!seen.has(entry.source)) {
				seen.add(entry.source)
				usage.push({ bodyId: body.id, sourceId: entry.source })
			}
			if (slot === "base" && strict) {
				bodies[i] = {
					...body,
					surface: { kind: surfaceKind(entry), source: entry.source },
				}
			}
		}
	})
	const credits = creditsOf(
		{ sources: { ...moonSources, ...catalogue.sources } },
		usage,
	)
	// the catalogue's own sources first (the Sun and the planets), then the moons'; a moon
	// source a texture also uses (the painted one) keeps its place and lists both
	const own = credits.filter((c) => catalogue.sources[c.id] !== undefined)
	const shared = credits.filter((c) => catalogue.sources[c.id] === undefined)
	const merged = [
		...own,
		...moonCredits.map((credit) => {
			const also = shared.find((c) => c.id === credit.id)
			return also === undefined
				? credit
				: { ...credit, bodies: [...also.bodies, ...credit.bodies] }
		}),
	]
	for (const credit of shared) {
		if (!moonCredits.some((c) => c.id === credit.id)) merged.push(credit)
	}
	return merged
}
