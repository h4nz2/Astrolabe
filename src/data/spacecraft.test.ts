/**
 * The spacecraft data contract (issue #35): the generated files match their
 * schema and the curated catalogue, the trajectories rebuild the JPL Horizons
 * states within the stated tolerance, cover their whole time range without a
 * gap, never jump where the frame hands over from the Sun to a planet in any
 * scale preset, and put known events where they happened.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
	AU_KM,
	SCALE_PRESETS,
	SCALE_PRESET_IDS,
	buildIndex,
	computeDisplayPositions,
	computeDisplayRadii,
	computePositions,
	type ScaleSettings,
} from "@/sim"
import {
	craftStateAt,
	createCraftState,
	decodeTrajectory,
	isoToJD,
	segmentState,
	type CentreFrame,
	type CraftTrajectory,
} from "@/sim/spacecraft"

import { SPEED_OF_LIGHT_KM_S } from "@/sim/light"

import { bodies } from "."
import checks from "./spacecraftCheck.json"
import {
	SPACECRAFT_EXTRA_TARGETS,
	SpacecraftFile,
	TrajectoriesFile,
} from "./spacecraftSchema"
import catalogueJson from "./spacecraft.json"
import trajectoriesJson from "./spacecraftTrajectories.json"

const catalogue = SpacecraftFile.parse(catalogueJson)
const trajectories = TrajectoriesFile.parse(trajectoriesJson)
const index = buildIndex(bodies)
const source = JSON.parse(
	readFileSync(join(__dirname, "..", "..", "data", "spacecraft.json"), "utf8"),
) as { craft: { id: string; events: unknown[] }[] }

const decoded = new Map<string, CraftTrajectory>(
	catalogue.craft.map((craft) => [
		craft.id,
		decodeTrajectory(craft, trajectories[craft.id], bodies, index),
	]),
)
const trajectoryOf = (id: string): CraftTrajectory => decoded.get(id)!

/** Bodies at `jd` under `scale`, as the scene's SimFrame has them. */
function frameAt(jd: number, scale: ScaleSettings): CentreFrame {
	const positionsKm = computePositions(bodies, jd, undefined, index)
	const displayRadiiKm = computeDisplayRadii(bodies, scale)
	return {
		bodies,
		positionsKm,
		displayKm: computeDisplayPositions(
			bodies,
			positionsKm,
			displayRadiiKm,
			scale,
			index,
		),
		displayRadiiKm,
		scale,
	}
}

const trueScale = SCALE_PRESETS.trueScale
const at = (id: string, iso: string, scale: ScaleSettings = trueScale) => {
	const jd = isoToJD(iso)
	const frame = frameAt(jd, scale)
	const state = craftStateAt(trajectoryOf(id), jd, frame, createCraftState())
	return { state, frame }
}
const bodyKm = (frame: CentreFrame, id: string) => {
	const i = index.get(id)! * 3
	return [
		frame.positionsKm[i],
		frame.positionsKm[i + 1],
		frame.positionsKm[i + 2],
	]
}
const dist = (a: ArrayLike<number>, b: ArrayLike<number>) =>
	Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

describe("src/data/spacecraft.json and spacecraftTrajectories.json", () => {
	it("hold the catalogue's craft, in its order, each with a trajectory", () => {
		expect(catalogue.craft.map((c) => c.id)).toEqual(
			source.craft.map((c) => c.id),
		)
		expect(Object.keys(trajectories).sort()).toEqual(
			catalogue.craft.map((c) => c.id).sort(),
		)
		for (const craft of catalogue.craft) {
			expect(craft.events.length).toBe(
				source.craft.find((c) => c.id === craft.id)!.events.length,
			)
		}
	})

	it("launch before the data starts, and the data covers a range", () => {
		for (const craft of catalogue.craft) {
			expect(isoToJD(craft.launch)).toBeLessThanOrEqual(isoToJD(craft.dataFrom))
			expect(isoToJD(craft.dataTo)).toBeGreaterThan(isoToJD(craft.dataFrom))
			if (craft.end !== null) {
				expect(isoToJD(craft.end.date)).toBeGreaterThan(isoToJD(craft.launch))
			}
		}
	})

	it("name only known targets", () => {
		const extra = new Set<string>(SPACECRAFT_EXTRA_TARGETS)
		for (const craft of catalogue.craft) {
			for (const event of craft.events) {
				if (event.target === undefined) continue
				expect(
					index.has(event.target) || extra.has(event.target),
					`${craft.id}: ${event.target}`,
				).toBe(true)
			}
			for (const orbit of craft.orbits)
				expect(index.has(orbit.center)).toBe(true)
		}
	})

	it("centre every segment on the Sun or a planet", () => {
		for (const [id, segments] of Object.entries(trajectories)) {
			for (const segment of segments) {
				const body = bodies[index.get(segment.center)!]
				expect(
					body.parentId === null || body.kind === "planet",
					`${id}: ${segment.center}`,
				).toBe(true)
				if (segment.blend !== null) {
					expect(segment.blend[0]).toBeLessThan(segment.blend[1])
				}
			}
		}
	})
})

describe("trajectory accuracy", () => {
	it("rebuilds the Horizons states it dropped within the tolerance", () => {
		expect(checks.length).toBeGreaterThan(100)
		const p = new Float64Array(3)
		for (const check of checks) {
			const trajectory = trajectoryOf(check.craft)
			const segments = [...trajectory.helio, ...trajectory.planetary]
			// check points name segments in file order
			const raw = trajectories[check.craft][check.segment]
			const segment = segments.find(
				(s) =>
					s.center === raw.center &&
					s.from === raw.t[0] + 2451545 &&
					s.jd.length === raw.t.length,
			)!
			segmentState(segment, check.t + 2451545, p)
			// scene (x, y, z) = ecliptic (x, z, -y)
			const error = Math.hypot(
				p[0] - check.p[0],
				p[1] - check.p[2],
				p[2] + check.p[1],
			)
			// the tolerance, plus the rounding of the stored samples
			expect(
				error,
				`${check.craft} #${check.segment} @${check.t}`,
			).toBeLessThan(check.tolKm * 1.05 + 5)
		}
	})

	// one test per craft: each samples 4001 instants, each a whole frame of bodies,
	// which together took longer than a test's time limit on a loaded machine
	it.each(catalogue.craft.map((craft) => craft.id))(
		"%s has a position at every instant of the data range, with no gap",
		(id) => {
			const trajectory = trajectoryOf(id)
			const state = createCraftState()
			const steps = 4000
			for (let k = 0; k <= steps; k++) {
				const jd =
					trajectory.fromJD +
					((trajectory.toJD - trajectory.fromJD) * k) / steps
				craftStateAt(trajectory, jd, frameAt(jd, trueScale), state)
				expect(state.available, `${id} @${jd}`).toBe(true)
				expect(state.trueKm.every(Number.isFinite)).toBe(true)
			}
		},
	)

	it("has no position outside the data range", () => {
		const trajectory = trajectoryOf("voyager1")
		const state = createCraftState()
		craftStateAt(
			trajectory,
			trajectory.fromJD - 1,
			frameAt(trajectory.fromJD - 1, trueScale),
			state,
		)
		expect(state.available).toBe(false)
	})

	it.each(SCALE_PRESET_IDS)(
		"never jumps where a segment hands over, in %s",
		(presetId) => {
			const scale = SCALE_PRESETS[presetId]
			const dt = 1 / 1440
			for (const craft of catalogue.craft) {
				const trajectory = trajectoryOf(craft.id)
				const drawn = (jd: number) =>
					craftStateAt(
						trajectory,
						jd,
						frameAt(jd, scale),
						createCraftState(),
					).displayKm.slice()
				const edges = [...trajectory.helio, ...trajectory.planetary].flatMap(
					(s) => [s.from, s.to],
				)
				for (const edge of edges) {
					if (
						edge - 3 * dt <= trajectory.fromJD ||
						edge + 3 * dt >= trajectory.toJD
					) {
						continue
					}
					// the step across the edge is no bigger than the steps beside it:
					// a hand-over that jumped would show as a spike
					const [a, b, c, d] = [-3, -1, 1, 3].map((k) => drawn(edge + k * dt))
					const across = dist(b, c)
					const beside = Math.max(dist(a, b), dist(c, d))
					expect(across, `${craft.id} @${edge}`).toBeLessThan(3 * beside + 1)
				}
			}
		},
	)
})

describe("where the craft are", () => {
	it("puts Voyager 1 at the heliopause, 121-122 AU out, on 25 August 2012", () => {
		const { state, frame } = at("voyager1", "2012-08-25T12:00Z")
		const au = dist(state.trueKm, bodyKm(frame, "sun")) / AU_KM
		expect(au).toBeGreaterThan(121)
		expect(au).toBeLessThan(122.5)
	})

	it("puts Voyager 1 about a light-day away in 2026", () => {
		const { state, frame } = at("voyager1", "2026-11-15T00:00Z")
		const hours =
			dist(state.trueKm, bodyKm(frame, "earth")) / SPEED_OF_LIGHT_KM_S / 3600
		expect(hours).toBeGreaterThan(22.5)
		expect(hours).toBeLessThan(25)
	})

	it("keeps JWST around L2, 1.2-1.9 million km beyond Earth, away from the Sun", () => {
		for (const iso of [
			"2023-01-01T00:00Z",
			"2025-06-01T00:00Z",
			"2026-09-25T00:00Z",
		]) {
			const { state, frame } = at("jwst", iso)
			const earth = bodyKm(frame, "earth")
			const d = dist(state.trueKm, earth)
			expect(d).toBeGreaterThan(1.2e6)
			expect(d).toBeLessThan(1.9e6)
			// farther from the Sun than Earth
			expect(dist(state.trueKm, bodyKm(frame, "sun"))).toBeGreaterThan(
				dist(earth, bodyKm(frame, "sun")),
			)
		}
	})

	it("brings Parker Solar Probe within 7 million km of the Sun's centre on 24 December 2024", () => {
		const { state, frame } = at("parker", "2024-12-24T11:53Z")
		const d = dist(state.trueKm, bodyKm(frame, "sun"))
		expect(d).toBeGreaterThan(6.8e6)
		expect(d).toBeLessThan(7.0e6)
	})

	it("keeps Juno within a few million km of the drawn Jupiter", () => {
		const { state, frame } = at("juno", "2026-09-25T00:00Z")
		expect(dist(state.trueKm, bodyKm(frame, "jupiter"))).toBeLessThan(9e6)
	})

	it("passes every planet it flew by at the recorded distance, from the drawn planet", () => {
		let checked = 0
		for (const craft of catalogue.craft) {
			for (const event of craft.events) {
				if (event.kind !== "flyby" || event.distanceKm === undefined) continue
				const { state, frame } = at(craft.id, event.date)
				const d = dist(state.trueKm, bodyKm(frame, event.target!))
				// the event is rounded to the minute, the path to its tolerance
				expect(
					Math.abs(d / event.distanceKm - 1),
					`${craft.id} ${event.target}`,
				).toBeLessThan(0.02)
				checked++
			}
		}
		// Voyager 2 alone passed four planets
		expect(checked).toBeGreaterThanOrEqual(20)
	})

	it("passes the drawn planet at the true miss distance, scaled like a moon, in every preset", () => {
		// Voyager 2 at Neptune: 29,240 km from the centre, 1.19 Neptune radii
		for (const presetId of SCALE_PRESET_IDS) {
			const { state, frame } = at(
				"voyager2",
				"1989-08-25T03:56Z",
				SCALE_PRESETS[presetId],
			)
			const n = index.get("neptune")! * 3
			const drawn = Math.hypot(
				state.displayKm[0] - frame.displayKm[n],
				state.displayKm[1] - frame.displayKm[n + 1],
				state.displayKm[2] - frame.displayKm[n + 2],
			)
			const radii = drawn / frame.displayRadiiKm[index.get("neptune")!]
			// inside the moon curves' knee (3 radii) distances keep true proportion
			expect(radii, presetId).toBeCloseTo(29240 / 24622, 1)
		}
	})
})
