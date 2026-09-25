/**
 * Which bodies the side-by-side comparison (#24) shows, as the ordered id list
 * of the `/compare?bodies=earth,jupiter,saturn` link. Pure and unit-tested.
 *
 * The first two ids are the pair the facts talk about: `[0]` is the body you
 * came from (the focused body of the solar system), `[1]` the one it is
 * compared with. Any further ids are drawn alongside at the same scale; a
 * click on one makes it the second of the pair (`promote`). The drawing
 * itself is always in the order of the solar system (`drawOrder`: the Sun,
 * each planet with its moons beside it), whatever
 * order the ids were picked in.
 */
import { bodies, bodyById, planets } from "@/data"

import type { PairFactKey } from "./compareFacts"

/** The most bodies drawn side by side: the Sun and the eight planets fit, with one to spare. */
export const MAX_COMPARE = 10

/** What `/compare` shows without a (valid) list: the comparison every textbook fudges. */
export const DEFAULT_COMPARE: readonly string[] = ["earth", "sun"]

/**
 * The first partner for a body, when only one is known (the card's "Compare
 * with…"): Earth for the Sun and the planets (the one world the class knows),
 * our Moon for moons (Io beside our Moon says more than Io beside Earth),
 * Earth for our Moon, and the Sun for Earth (the comparison that truly lands).
 */
export function defaultPartner(id: string): string {
	const body = bodyById.get(id)
	if (id === "earth") return "sun"
	if (id === "moon" || body === undefined) return "earth"
	return body.kind === "moon" ? "moon" : "earth"
}

/** The ids of a `bodies` search param: known bodies only, no repeats, at most MAX_COMPARE. */
export function parseBodies(param: string | undefined): string[] {
	if (param === undefined) return []
	const ids: string[] = []
	for (const raw of param.split(",")) {
		const id = raw.trim()
		if (bodyById.has(id) && !ids.includes(id)) ids.push(id)
		if (ids.length === MAX_COMPARE) break
	}
	return ids
}

/** A list the page can show: always at least a pair. */
export function completeBodies(ids: readonly string[]): string[] {
	if (ids.length === 0) return [...DEFAULT_COMPARE]
	if (ids.length === 1) {
		const partner = defaultPartner(ids[0])
		return [ids[0], partner === ids[0] ? "earth" : partner]
	}
	return [...ids]
}

export const formatBodies = (ids: readonly string[]): string => ids.join(",")

/**
 * Puts `id` at `index`. A body already in the list swaps places with the one
 * it replaces, so picking Jupiter as the first body while it is the second
 * swaps the pair instead of listing Jupiter twice.
 */
export function replaceAt(
	ids: readonly string[],
	index: number,
	id: string,
): string[] {
	if (!bodyById.has(id) || index < 0 || index >= ids.length) return [...ids]
	const next = [...ids]
	const existing = next.indexOf(id)
	if (existing !== -1) next[existing] = next[index]
	next[index] = id
	return next
}

/** Makes `id` the second of the pair (a click on a drawn body); the first stays. */
export function promote(ids: readonly string[], id: string): string[] {
	const at = ids.indexOf(id)
	if (at < 2) return [...ids]
	const next = ids.filter((other) => other !== id)
	next.splice(1, 0, id)
	return next
}

/** Swaps the pair: "Earth and Jupiter" becomes "Jupiter and Earth". */
export function swapPair(ids: readonly string[]): string[] {
	if (ids.length < 2) return [...ids]
	return [ids[1], ids[0], ...ids.slice(2)]
}

/** Adds a body at the end (it is drawn in its place in the system all the same). */
export function addBody(ids: readonly string[], id: string): string[] {
	if (!bodyById.has(id) || ids.includes(id) || ids.length >= MAX_COMPARE) {
		return [...ids]
	}
	return [...ids, id]
}

/** Removes a body; a pair always stays. */
export function removeBody(ids: readonly string[], id: string): string[] {
	if (ids.length <= 2) return [...ids]
	return ids.filter((other) => other !== id)
}

const systemIndex = new Map(bodies.map((body, i) => [body.id, i]))

/** Sorts by the planet a body belongs to (itself for the Sun and planets), then by depth, then as in the data. */
function orderKey(id: string): [number, number, number] {
	const chain: string[] = []
	for (
		let at = bodyById.get(id);
		at !== undefined;
		at = at.parentId === null ? undefined : bodyById.get(at.parentId)
	) {
		chain.unshift(at.id)
	}
	const planet = chain[1] ?? chain[0] ?? id
	return [systemIndex.get(planet) ?? 0, chain.length, systemIndex.get(id) ?? 0]
}

/** The ids in the order of the solar system: the Sun, then each planet followed by its own moons. */
export const drawOrder = (ids: readonly string[]): string[] =>
	[...ids]
		.map((id) => ({ id, key: orderKey(id) }))
		.sort(
			(a, b) =>
				a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2],
		)
		.map(({ id }) => id)

/** The headings the ideas are listed under (`compare.ideaGroups.<group>`). */
export const COMPARE_PRESET_GROUPS = ["sizes", "moons", "surprises"] as const
export type ComparePresetGroup = (typeof COMPARE_PRESET_GROUPS)[number]

/**
 * A ready-made comparison a teacher can pick without choosing bodies one by
 * one (#24), each carrying a surprise (#40). The idea is pure data: its title
 * is `compare.presets.<id>`, its one-line teaser `compare.teasers.<id>` (both
 * with reading levels, in every locale). Its link is its body list; the page
 * recognises the idea by that set of bodies (`presetFor`), so swapping the
 * pair or clicking a drawn body keeps it, adding or removing a body leaves it.
 */
export interface ComparePreset {
	id:
		| "sunEarth"
		| "earthMoon"
		| "planets"
		| "sunPlanets"
		| "bigMoons"
		| "earthTwin"
		| "moonsBeatPlanet"
		| "jupiterAcrossSun"
		| "marsSmall"
		| "galileanMoons"
		| "iceGiants"
		| "potatoMoons"
		| "weighMost"
		| "bigForItsPlanet"
	group: ComparePresetGroup
	/** The first two are the pair the facts talk about. */
	bodies: readonly string[]
	/** The comparison that makes the idea's point, shown first (else the usual order). */
	lead?: PairFactKey
}

const planetIds = planets.map((planet) => planet.id)
const earthFirst = ["earth", ...planetIds.filter((id) => id !== "earth")]
// the pair of the planet presets is Earth and Jupiter: home and the giant
const earthJupiterFirst = [
	"earth",
	"jupiter",
	...earthFirst.filter((id) => id !== "earth" && id !== "jupiter"),
]

/** Listed by group, in this order within each group. Every body set is unique. */
export const COMPARE_PRESETS: readonly ComparePreset[] = [
	// sizes
	{ id: "sunEarth", group: "sizes", bodies: ["earth", "sun"], lead: "volume" },
	{
		id: "sunPlanets",
		group: "sizes",
		bodies: ["earth", "sun", ...earthFirst.slice(1)],
		lead: "mass",
	},
	{
		id: "jupiterAcrossSun",
		group: "sizes",
		bodies: ["jupiter", "sun", "earth"],
		lead: "size",
	},
	{
		id: "planets",
		group: "sizes",
		bodies: earthJupiterFirst,
		lead: "mass",
	},
	{
		id: "marsSmall",
		group: "sizes",
		bodies: ["mars", "earth", "moon"],
		lead: "size",
	},
	{
		id: "iceGiants",
		group: "sizes",
		bodies: ["uranus", "neptune", "earth"],
		lead: "size",
	},
	// moons
	{ id: "earthMoon", group: "moons", bodies: ["earth", "moon"], lead: "size" },
	{
		id: "bigForItsPlanet",
		group: "moons",
		bodies: ["moon", "earth", "jupiter", "ganymede"],
		lead: "size",
	},
	{
		id: "bigMoons",
		group: "moons",
		bodies: ["moon", "ganymede", "titan", "callisto", "io", "europa", "triton"],
		lead: "size",
	},
	{
		id: "galileanMoons",
		group: "moons",
		bodies: ["io", "ganymede", "europa", "callisto", "moon"],
		lead: "orbit",
	},
	{
		id: "potatoMoons",
		group: "moons",
		bodies: ["phobos", "moon", "deimos"],
		lead: "size",
	},
	// surprises
	{
		id: "earthTwin",
		group: "surprises",
		bodies: ["venus", "earth"],
		lead: "size",
	},
	{
		id: "moonsBeatPlanet",
		group: "surprises",
		bodies: ["ganymede", "mercury", "titan"],
		lead: "size",
	},
	{
		id: "weighMost",
		group: "surprises",
		bodies: ["earth", "jupiter", "mars", "moon"],
		lead: "weight",
	},
]

/** The idea on screen: the preset with exactly these bodies, in any order. */
export function presetFor(ids: readonly string[]): ComparePreset | undefined {
	const set = new Set(ids)
	return COMPARE_PRESETS.find(
		(preset) =>
			preset.bodies.length === set.size &&
			preset.bodies.every((id) => set.has(id)),
	)
}
