import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import {
	SCALE_PRESETS,
	SCALE_PRESET_IDS,
	TRUE_SCALE,
	dateToJD,
	toKm,
} from "@/sim"
import { frontRadiusKm } from "@/sim/light"

import { createSimFrame, updateSimFrame } from "../scene/simFrame"
import {
	FRONT_VERTICES,
	LOCAL_FADE_START,
	MAX_FRONT_RADIUS_KM,
	frontAnchor,
	frontOpacity,
	frontPointDisplayKm,
	frontSource,
	mapTruePointKm,
	writeFront,
	type FrontState,
} from "./lightFront"
import { pulseArrivals } from "./lightTravel"

const JD = dateToJD(new Date("2026-09-25T12:00:00Z"))
const at = (id: string): number => bodies.findIndex((body) => body.id === id)
const newState = (): FrontState => ({ visible: false, opacity: 0, anchor: 0 })

const distance = (a: ArrayLike<number>, b: ArrayLike<number>, bi = 0) =>
	Math.hypot(a[0] - b[bi], a[1] - b[bi + 1], a[2] - b[bi + 2])

/** The front's drawn point heading for body `i`, at the front's radius at `jd`. */
const pointToward = (
	frame: ReturnType<typeof createSimFrame>,
	source: ReturnType<typeof frontSource>,
	emitJD: number,
	i: number,
) => {
	const radiusKm = frontRadiusKm(emitJD, frame.jd)
	const o = i * 3
	const theta = Math.atan2(
		frame.positionsKm[o + 2] - source.origin[2],
		frame.positionsKm[o] - source.origin[0],
	)
	const out = new Float64Array(3)
	frontPointDisplayKm(
		frame,
		source,
		frontAnchor(source, radiusKm),
		radiusKm,
		theta,
		out,
	)
	return out
}

describe("frontSource", () => {
	it("anchors a planet's or a moon's early front on the planet, the Sun's on nothing", () => {
		const sun = frontSource(
			bodies,
			new Map(bodies.map((b, i) => [b.id, i])),
			0,
			JD,
		)
		expect(sun.anchor).toBe(sun.root)
		expect(sun.neighbourhoodKm).toBe(Infinity)
		const index = new Map(bodies.map((b, i) => [b.id, i]))
		const earth = frontSource(bodies, index, at("earth"), JD)
		expect(earth.anchor).toBe(at("earth"))
		expect(earth.neighbourhoodKm).toBeGreaterThan(1.4e6)
		const moon = frontSource(bodies, index, at("moon"), JD)
		expect(moon.anchor).toBe(at("earth"))
		expect(distance(moon.origin, earth.origin)).toBeGreaterThan(3.5e5)
	})
})

describe("front anchor and fading", () => {
	const index = new Map(bodies.map((b, i) => [b.id, i]))
	const earth = frontSource(bodies, index, at("earth"), JD)

	it("switches from the planet to the Sun at the edge of the neighbourhood", () => {
		expect(frontAnchor(earth, 1e5)).toBe(at("earth"))
		expect(frontAnchor(earth, earth.neighbourhoodKm * 1.01)).toBe(earth.root)
	})

	it("fades the planet-anchored front out before the switch, never the Sun's", () => {
		expect(frontOpacity(earth, earth.neighbourhoodKm * LOCAL_FADE_START)).toBe(
			1,
		)
		const mid = frontOpacity(earth, earth.neighbourhoodKm * 0.8)
		expect(mid).toBeGreaterThan(0)
		expect(mid).toBeLessThan(1)
		expect(frontOpacity(earth, earth.neighbourhoodKm * 0.999)).toBeLessThan(
			0.01,
		)
		expect(frontOpacity(earth, earth.neighbourhoodKm * 2)).toBe(1)
		const sun = frontSource(bodies, index, 0, JD)
		expect(frontOpacity(sun, 1e9)).toBe(1)
	})
})

describe("writeFront", () => {
	it("draws the true circle at true scale", () => {
		const frame = createSimFrame(bodies, JD, TRUE_SCALE)
		const source = frontSource(bodies, frame.index, at("mars"), JD - 0.01)
		updateSimFrame(frame, JD)
		const positions = new Float32Array(FRONT_VERTICES * 3)
		const radiusKm = frontRadiusKm(JD - 0.01, JD)
		const state = writeFront(frame, source, radiusKm, positions, newState())
		expect(state.visible).toBe(true)
		for (let v = 0; v < FRONT_VERTICES; v += 37) {
			const p = [0, 1, 2].map((k) => toKm(positions[v * 3 + k]))
			expect(distance(p, source.origin) / radiusKm).toBeCloseTo(1, 5)
			expect(p[1]).toBeCloseTo(source.origin[1], 0)
		}
	})

	it("draws nothing before the flash or once it is far beyond the planets", () => {
		const frame = createSimFrame(bodies, JD, TRUE_SCALE)
		const source = frontSource(bodies, frame.index, 0, JD)
		const positions = new Float32Array(FRONT_VERTICES * 3)
		expect(writeFront(frame, source, 0, positions, newState()).visible).toBe(
			false,
		)
		expect(
			writeFront(frame, source, MAX_FRONT_RADIUS_KM * 2, positions, newState())
				.visible,
		).toBe(false)
	})

	it("is relative to the render origin, like everything drawn", () => {
		const frame = createSimFrame(bodies, JD, TRUE_SCALE)
		updateSimFrame(frame, JD, at("earth"))
		const source = frontSource(bodies, frame.index, at("earth"), JD - 1e-5)
		const positions = new Float32Array(FRONT_VERTICES * 3)
		writeFront(
			frame,
			source,
			frontRadiusKm(JD - 1e-5, JD),
			positions,
			newState(),
		)
		// a front under a second old sits around the origin (Earth), not at 1 AU
		expect(Math.abs(toKm(positions[0]))).toBeLessThan(1e6)
	})
})

describe("the front passes through every body as drawn when the light arrives", () => {
	for (const presetId of SCALE_PRESET_IDS) {
		const scale = SCALE_PRESETS[presetId]

		it(`reaches each planet from the Sun on time in ${presetId}`, () => {
			const frame = createSimFrame(bodies, JD, scale)
			const source = frontSource(bodies, frame.index, 0, JD)
			for (const arrival of pulseArrivals({ emitterId: "sun", emitJD: JD })) {
				updateSimFrame(frame, arrival.jd)
				const i = at(arrival.id)
				const point = pointToward(frame, source, JD, i)
				// same drawn distance from the Sun as the planet: the front is on it
				const drawnPlanet = distance(
					[
						frame.displayKm[i * 3],
						frame.displayKm[i * 3 + 1],
						frame.displayKm[i * 3 + 2],
					],
					frame.displayKm,
				)
				const drawnFront = distance(point, frame.displayKm)
				expect(drawnFront / drawnPlanet).toBeCloseTo(1, 6)
				// a second earlier the front had not got there yet
				updateSimFrame(frame, arrival.jd - 1 / 86400)
				const before = distance(
					pointToward(frame, source, JD, i),
					frame.displayKm,
				)
				expect(before).toBeLessThan(drawnPlanet)
			}
		})

		it(`reaches the Moon from Earth on time in ${presetId}`, () => {
			const frame = createSimFrame(bodies, JD, scale)
			const source = frontSource(bodies, frame.index, at("earth"), JD)
			const moon = pulseArrivals({ emitterId: "earth", emitJD: JD })[0]
			expect(moon.id).toBe("moon")
			updateSimFrame(frame, moon.jd)
			const e = at("earth") * 3
			const m = at("moon") * 3
			const earthDrawn = [
				frame.displayKm[e],
				frame.displayKm[e + 1],
				frame.displayKm[e + 2],
			]
			const point = pointToward(frame, source, JD, at("moon"))
			const moonDrawn = distance(earthDrawn, frame.displayKm, m)
			// the front sits at the Moon's drawn distance from Earth (Earth moved ~40 km meanwhile)
			expect(distance(point, earthDrawn) / moonDrawn).toBeCloseTo(1, 2)
		})
	}
})

describe("mapTruePointKm", () => {
	it("maps every planet and moon onto itself as drawn, in every preset and in anchored frames (#31)", () => {
		for (const presetId of SCALE_PRESET_IDS) {
			for (const anchored of [null, "earth", "jupiter"]) {
				const frame = createSimFrame(bodies, JD, SCALE_PRESETS[presetId])
				if (anchored !== null) {
					frame.frameBlend.anchors[0] = at(anchored)
					frame.frameBlend.weights[0] = anchored === "earth" ? 1 : 0.4
				}
				updateSimFrame(frame, JD)
				const out = new Float64Array(3)
				for (const id of [
					"mercury",
					"earth",
					"mars",
					"neptune",
					"moon",
					"io",
				]) {
					const i = at(id)
					const body = bodies[i]
					// planets are drawn by the root's rule, moons by their planet's
					const anchor = body.kind === "planet" ? 0 : at(body.parentId!)
					const o = i * 3
					mapTruePointKm(
						frame,
						0,
						anchor,
						frame.positionsKm[o],
						frame.positionsKm[o + 1],
						frame.positionsKm[o + 2],
						out,
					)
					const scale = Math.max(
						1,
						distance(frame.displayKm, frame.displayKm, o),
					)
					expect(distance(out, frame.displayKm, o) / scale).toBeLessThan(1e-9)
				}
			}
		}
	})
})
