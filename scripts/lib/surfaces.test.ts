import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
	creditsOf,
	PAINTED_SOURCE,
	resolveSurfaces,
	surfacePath,
	type SurfaceCatalogue,
} from "./surfaces"

const root = join(__dirname, "..", "..")
const real = JSON.parse(
	readFileSync(join(root, "data", "moon-surfaces.json"), "utf8"),
) as SurfaceCatalogue
const built = JSON.parse(
	readFileSync(join(root, "data", "moon-surfaces.built.json"), "utf8"),
) as Record<string, { color: string; width: number; bytes: number }>

const source = (extra: Record<string, unknown> = {}) => ({
	title: "t",
	credit: "c",
	short: "s",
	url: "https://example.org/",
	licence: "Public domain",
	licenceUrl: "https://example.org/licence",
	...extra,
})

const minimal = (
	patch: Partial<Record<keyof SurfaceCatalogue, unknown>> = {},
) => ({
	sources: {
		[PAINTED_SOURCE]: source(),
		nasa: source({ file: "https://example.org/a.tif" }),
	},
	maps: {
		io: {
			planet: "jupiter",
			source: "nasa",
			width: 1024,
			centreLonEast: 0,
			albedo: 0.6,
			colour: 1,
		},
	},
	painted: {},
	families: {
		rocks: {
			planet: "jupiter",
			members: ["leda", "elara"],
			recipe: { pattern: "cratered", albedo: 0.05, hue: "#888888" },
			basis: "dark",
		},
	},
	...patch,
})

describe("resolveSurfaces", () => {
	it("resolves maps, painted moons and family members", () => {
		const { byId } = resolveSurfaces(minimal())
		expect(byId.get("io")).toMatchObject({
			kind: "map",
			sourceId: "nasa",
			filled: false,
		})
		expect(byId.get("leda")).toMatchObject({
			kind: "painted",
			family: "rocks",
			sourceId: PAINTED_SOURCE,
			width: 512,
		})
	})

	it("rejects a moon listed twice, an unknown source and a grey map without a hue", () => {
		expect(() =>
			resolveSurfaces(
				minimal({
					painted: {
						leda: {
							planet: "jupiter",
							recipe: { pattern: "smooth", albedo: 0.5, hue: "#ffffff" },
							basis: "x",
						},
					},
				}),
			),
		).toThrow(/more than one surface/)
		expect(() =>
			resolveSurfaces(
				minimal({
					maps: {
						io: {
							planet: "jupiter",
							source: "esa",
							width: 1024,
							centreLonEast: 0,
							albedo: 0.6,
							colour: 1,
						},
					},
				}),
			),
		).toThrow(/unknown source "esa"/)
		expect(() =>
			resolveSurfaces(
				minimal({
					maps: {
						io: {
							planet: "jupiter",
							source: "nasa",
							width: 1024,
							centreLonEast: 0,
							albedo: 0.6,
						},
					},
				}),
			),
		).toThrow(/grey \(hue\) or colour/)
	})

	it("lists only the sources in use in the credits, with their bodies", () => {
		const { catalogue } = resolveSurfaces(minimal())
		const credits = creditsOf(catalogue, [
			{ bodyId: "leda", sourceId: PAINTED_SOURCE },
			{ bodyId: "elara", sourceId: PAINTED_SOURCE },
		])
		expect(credits).toHaveLength(1)
		expect(credits[0]).toMatchObject({
			id: PAINTED_SOURCE,
			kind: "painted",
			bodies: ["leda", "elara"],
		})
	})
})

describe("data/moon-surfaces.json", () => {
	const { catalogue, byId } = resolveSurfaces(real)

	it("records a licence that allows redistribution for every source", () => {
		for (const [id, s] of Object.entries(catalogue.sources)) {
			expect(["Public domain", "MIT", "No known restrictions"], id).toContain(
				s.licence,
			)
			expect(s.url, id).toMatch(/^https:\/\//)
		}
	})

	it("downloads every real map from its recorded source", () => {
		for (const surface of byId.values()) {
			if (surface.kind !== "map") continue
			expect(catalogue.sources[surface.sourceId].file, surface.id).toBeDefined()
		}
	})

	it("says why each painted surface looks the way it does", () => {
		for (const surface of byId.values()) {
			if (surface.kind === "painted")
				expect(surface.basis.length, surface.id).toBeGreaterThan(20)
		}
	})

	it("has generated every surface, within the download budget", () => {
		for (const surface of byId.values()) {
			expect(built[surface.id], surface.id).toBeDefined()
		}
		const all = Object.values(built)
		// a long-tail moon is a small file; nothing is a multi-megabyte download
		for (const [id, entry] of Object.entries(built)) {
			expect(entry.bytes, id).toBeLessThan(700 * 1024)
			if (byId.get(id)?.kind === "painted" && entry.width === 512) {
				expect(entry.bytes, id).toBeLessThan(20 * 1024)
			}
		}
		expect(all.reduce((sum, e) => sum + e.bytes, 0)).toBeLessThan(
			6 * 1024 * 1024,
		)
	})

	it("stores each moon's image beside its planet", () => {
		expect(surfacePath("uranus", "miranda")).toBe(
			"/assets/textures/uranus/satellites/miranda.jpg",
		)
	})
})
