import { describe, expect, it } from "vitest"

import { bodies } from "@/data"

import {
	MAX_OCCLUDERS,
	OCCLUDER_STRIDE,
	angleBetween,
	discOverlapArea,
	illuminatedFraction,
	occluderCandidates,
	phaseAngle,
	selectOccluders,
	sunVisibleFraction,
	type LitBody,
} from "./lighting"
import { buildIndex, computePositions } from "./positions"
import { rootIndexOf } from "./scale"

const SUN_RADIUS = 695_700
const AU = 149_597_870.7

describe("discOverlapArea", () => {
	it("is 0 for discs apart and the smaller disc when one contains the other", () => {
		expect(discOverlapArea(1, 1, 2)).toBe(0)
		expect(discOverlapArea(1, 1, 3)).toBe(0)
		expect(discOverlapArea(2, 1, 0.5)).toBeCloseTo(Math.PI, 12)
		expect(discOverlapArea(1, 2, 1)).toBeCloseTo(Math.PI, 12)
	})

	it("matches the symmetric lens formula for equal discs", () => {
		const r = 1.3
		const d = 0.9
		const lens =
			2 * r * r * Math.acos(d / (2 * r)) -
			(d / 2) * Math.sqrt(4 * r * r - d * d)
		expect(discOverlapArea(r, r, d)).toBeCloseTo(lens, 12)
	})

	it("works at the milliradian sizes of the Sun seen from a planet", () => {
		const a = 4.65e-3
		expect(discOverlapArea(a, a, 0)).toBeCloseTo(Math.PI * a * a, 15)
		const half = discOverlapArea(a, a, 1e-9)
		expect(half / (Math.PI * a * a)).toBeCloseTo(1, 6)
	})
})

describe("angleBetween", () => {
	it("is exact for tiny and for obtuse angles", () => {
		expect(angleBetween(1, 0, 0, 1, 1e-7, 0)).toBeCloseTo(1e-7, 15)
		expect(angleBetween(1, 0, 0, -1, 0, 0)).toBeCloseTo(Math.PI, 12)
		expect(angleBetween(2, 0, 0, 0, 5, 0)).toBeCloseTo(Math.PI / 2, 12)
	})
})

describe("sunVisibleFraction", () => {
	// receiver frame: the Sun 1 AU away along +x, a point on the sunward surface
	const sun = [AU, 0, 0] as const
	const point = [6371, 0, 0] as const
	const packed = (...entries: number[][]) => {
		const out = new Float64Array(MAX_OCCLUDERS * OCCLUDER_STRIDE)
		entries.forEach((entry, k) => out.set(entry, k * OCCLUDER_STRIDE))
		return out
	}
	const visible = (occluders: Float64Array, count: number) =>
		sunVisibleFraction(...point, ...sun, SUN_RADIUS, occluders, count)

	it("is 1 in open sunlight", () => {
		expect(visible(packed(), 0)).toBe(1)
	})

	it("is 0 in an umbra: a caster wider than the Sun, dead ahead", () => {
		// the Moon at perigee, straight between the point and the Sun
		expect(visible(packed([6371 + 356_500, 0, 0, 1737.4]), 1)).toBe(0)
	})

	it("leaves an annulus when the caster is smaller than the Sun's disc", () => {
		const distance = 406_700 // the Moon at apogee
		const b = Math.asin(1737.4 / distance)
		const a = Math.asin(SUN_RADIUS / (AU - 6371))
		const fraction = visible(packed([6371 + distance, 0, 0, 1737.4]), 1)
		expect(fraction).toBeCloseTo(1 - (b / a) ** 2, 4)
		expect(fraction).toBeGreaterThan(0)
		expect(fraction).toBeLessThan(0.2)
	})

	it("gives a partial eclipse off axis and nothing beyond the penumbra", () => {
		const distance = 384_400
		const partial = visible(packed([6371 + distance, 2500, 0, 1737.4]), 1)
		expect(partial).toBeGreaterThan(0.2)
		expect(partial).toBeLessThan(0.9)
		expect(visible(packed([6371 + distance, 20_000, 0, 1737.4]), 1)).toBe(1)
	})

	it("ignores a caster behind the point or beyond the Sun", () => {
		expect(visible(packed([-384_400, 0, 0, 1737.4]), 1)).toBe(1)
		expect(visible(packed([AU * 2, 0, 0, SUN_RADIUS * 10]), 1)).toBe(1)
	})

	it("multiplies several casters", () => {
		const off = visible(packed([6371 + 384_400, 2500, 0, 1737.4]), 1)
		const twice = visible(
			packed(
				[6371 + 384_400, 2500, 0, 1737.4],
				[6371 + 384_400, 2500, 0, 1737.4],
			),
			2,
		)
		expect(twice).toBeCloseTo(off * off, 12)
	})
})

describe("occluderCandidates", () => {
	const idOf = (list: number[]) => list.map((i) => bodies[i].id).sort()
	const at = (id: string) => bodies.findIndex((body) => body.id === id)

	it("gives a planet its moons and nothing else", () => {
		expect(idOf(occluderCandidates(bodies, at("earth")))).toEqual(["moon"])
		expect(occluderCandidates(bodies, at("venus"))).toEqual([])
		const jupiter = idOf(occluderCandidates(bodies, at("jupiter")))
		expect(jupiter).toContain("io")
		expect(jupiter.every((id) => bodies[at(id)].parentId === "jupiter")).toBe(
			true,
		)
	})

	it("gives a moon its planet and its siblings", () => {
		expect(idOf(occluderCandidates(bodies, at("moon")))).toEqual(["earth"])
		const io = idOf(occluderCandidates(bodies, at("io")))
		expect(io).toContain("jupiter")
		expect(io).toContain("europa")
		expect(io).not.toContain("io")
		expect(io).not.toContain("saturn")
	})

	it("gives the Sun nothing: it casts and receives no shadow", () => {
		expect(occluderCandidates(bodies, rootIndexOf(bodies))).toEqual([])
	})
})

describe("selectOccluders", () => {
	// receiver 0 at the origin, the Sun (1) 1 AU along +x, casters 2.. in between
	const synthetic = (casters: [number, number, number, number][]) => {
		const list: LitBody[] = [
			{ id: "r", parentId: "p", radiusKm: 6000 },
			{ id: "sun", parentId: null, radiusKm: SUN_RADIUS },
			...casters.map((_, k) => ({
				id: `c${k}`,
				parentId: "r",
				radiusKm: casters[k][3],
			})),
		]
		const positions = new Float64Array(list.length * 3)
		positions.set([AU, 0, 0], 3)
		casters.forEach(([x, y, z], k) => positions.set([x, y, z], (k + 2) * 3))
		const candidates = casters.map((_, k) => k + 2)
		return { list, positions, candidates }
	}
	const out = new Float64Array(MAX_OCCLUDERS * OCCLUDER_STRIDE)

	it("keeps casters whose penumbra reaches the receiver, relative to it", () => {
		const { list, positions, candidates } = synthetic([
			[400_000, 3000, 0, 1700], // on the Sun line: shades
			[400_000, 60_000, 0, 1700], // far off the line: cannot
			[-400_000, 0, 0, 1700], // behind the receiver: cannot
		])
		const count = selectOccluders(
			list,
			positions,
			0,
			1,
			candidates,
			() => true,
			out,
		)
		expect(count).toBe(1)
		expect(Array.from(out.slice(0, 4))).toEqual([400_000, 3000, 0, 1700])
	})

	it("keeps the best MAX_OCCLUDERS, closest to the Sun line first, and honours accept", () => {
		const casters: [number, number, number, number][] = [5, 1, 4, 2, 3, 0].map(
			(k) => [400_000, 1000 * k, 0, 1700],
		)
		const { list, positions, candidates } = synthetic(casters)
		const count = selectOccluders(
			list,
			positions,
			0,
			1,
			candidates,
			() => true,
			out,
		)
		expect(count).toBe(MAX_OCCLUDERS)
		const offsets = Array.from({ length: count }, (_, k) => out[k * 4 + 1])
		expect(offsets).toEqual([0, 1000, 2000, 3000])

		const hidden = candidates[5] // the one dead on the line
		const filtered = selectOccluders(
			list,
			positions,
			0,
			1,
			candidates,
			(j) => j !== hidden,
			out,
		)
		expect(filtered).toBe(MAX_OCCLUDERS)
		expect(out[1]).toBe(1000)
	})
})

describe("eclipses and phases from the real data", () => {
	const index = buildIndex(bodies)
	const sun = rootIndexOf(bodies)
	const at = (id: string) => index.get(id) ?? -1
	const out = new Float64Array(MAX_OCCLUDERS * OCCLUDER_STRIDE)

	/** Fraction of sunlight at the point of `receiver` straight under the Sun line of its first caster. */
	const shadowUnderFirstCaster = (
		positions: Float64Array,
		receiver: number,
	): number | null => {
		const count = selectOccluders(
			bodies,
			positions,
			receiver,
			sun,
			occluderCandidates(bodies, receiver),
			() => true,
			out,
		)
		if (count === 0) return null
		const r = receiver * 3
		const s = sun * 3
		const sx = positions[s] - positions[r]
		const sy = positions[s + 1] - positions[r + 1]
		const sz = positions[s + 2] - positions[r + 2]
		const d = Math.hypot(sx, sy, sz)
		const [ux, uy, uz] = [sx / d, sy / d, sz / d]
		const [vx, vy, vz] = [out[0], out[1], out[2]]
		const radius = bodies[receiver].radiusKm
		// where the Sun -> caster axis meets the receiver's sunward surface
		const along = vx * ux + vy * uy + vz * uz
		const px = vx - along * ux
		const py = vy - along * uy
		const pz = vz - along * uz
		const off = Math.hypot(px, py, pz)
		if (off >= radius) return 1
		const lift = Math.sqrt(radius * radius - off * off)
		return sunVisibleFraction(
			px + lift * ux,
			py + lift * uy,
			pz + lift * uz,
			sx,
			sy,
			sz,
			bodies[sun].radiusKm,
			out,
			count,
		)
	}

	it("puts Io's shadow on Jupiter once every orbit (a solar eclipse seen from space)", () => {
		const jupiter = at("jupiter")
		const positions = new Float64Array(bodies.length * 3)
		let darkest = 1
		// Io circles Jupiter in 1.77 days; its umbra reaches the cloud tops
		for (let t = 0; t < 1.8; t += 0.002) {
			computePositions(bodies, 2461122.5 + t, positions, index)
			const fraction = shadowUnderFirstCaster(positions, jupiter)
			if (fraction !== null) darkest = Math.min(darkest, fraction)
		}
		expect(darkest).toBeLessThan(0.05)
	})

	it("lights the Moon's face toward the Earth in step with its phase", () => {
		const positions = new Float64Array(bodies.length * 3)
		const moon = at("moon")
		const earth = at("earth")
		const fractions: number[] = []
		for (let t = 0; t < 29.6; t += 0.25) {
			computePositions(bodies, 2461122.5 + t, positions, index)
			fractions.push(
				illuminatedFraction(phaseAngle(positions, moon, earth, sun)),
			)
		}
		// one full cycle of phases within a synodic month: from new to full and back
		expect(Math.min(...fractions)).toBeLessThan(0.01)
		expect(Math.max(...fractions)).toBeGreaterThan(0.99)
	})

	it("illuminatedFraction is 1 at full phase and 0 at new", () => {
		expect(illuminatedFraction(0)).toBe(1)
		expect(illuminatedFraction(Math.PI)).toBeCloseTo(0, 15)
		expect(illuminatedFraction(Math.PI / 2)).toBeCloseTo(0.5, 15)
	})
})
