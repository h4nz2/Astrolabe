import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { SCALE_PRESETS, SCALE_PRESET_IDS } from "@/sim/scale"
import { AU_KM } from "@/sim/units"

import { createSimFrame } from "../scene/simFrame"
import {
	COLD_AU,
	MAX_MASTER_GAIN,
	PLANET_NOTES_HZ,
	SUN_NOTE_HZ,
	WARM_AU,
	ambientMix,
	bodyNoteHz,
	equivalentTrueKm,
	volumeGain,
	whooshShape,
} from "./mix"
import { probeCamera } from "./SoundProbe"

describe("volumeGain", () => {
	it("is silent at zero, gentle in the lower half, capped at the top", () => {
		expect(volumeGain(0)).toBe(0)
		expect(volumeGain(0.5)).toBeCloseTo(MAX_MASTER_GAIN / 4)
		expect(volumeGain(1)).toBe(MAX_MASTER_GAIN)
		expect(volumeGain(5)).toBe(MAX_MASTER_GAIN)
		expect(volumeGain(-1)).toBe(0)
	})
})

describe("ambientMix", () => {
	it("is all warmth near the Sun and all cold at Neptune", () => {
		expect(ambientMix(WARM_AU)).toMatchObject({ warm: 1, cold: 0, level: 1 })
		expect(ambientMix(0.01).warm).toBe(1)
		expect(ambientMix(COLD_AU)).toMatchObject({ warm: 0, cold: 1, level: 1 })
	})

	it("cools steadily with distance, and dims the cutoff", () => {
		const distances = [0.4, 0.7, 1, 1.5, 5.2, 9.5, 19, 30]
		const mixes = distances.map(ambientMix)
		for (let i = 1; i < mixes.length; i++) {
			expect(mixes[i].warm).toBeLessThan(mixes[i - 1].warm)
			expect(mixes[i].cold).toBeGreaterThan(mixes[i - 1].cold)
			expect(mixes[i].cutoffHz).toBeLessThan(mixes[i - 1].cutoffHz)
		}
		// Earth sits on the warm side, Jupiter about halfway
		expect(ambientMix(1).warm).toBeGreaterThan(0.7)
		expect(ambientMix(5.2).warm).toBeGreaterThan(0.3)
		expect(ambientMix(5.2).warm).toBeLessThan(0.6)
	})

	it("thins out past Neptune, never to nothing", () => {
		expect(ambientMix(100).level).toBeLessThan(1)
		expect(ambientMix(1e6).level).toBe(0.5)
	})

	it("treats nonsense as Earth's distance", () => {
		expect(ambientMix(Number.NaN)).toEqual(ambientMix(1))
		expect(ambientMix(-3)).toEqual(ambientMix(1))
	})
})

describe("equivalentTrueKm", () => {
	const pairs = [
		{ display: 100, true: 1000 },
		{ display: 200, true: 8000 },
		{ display: 400, true: 64000 },
	]

	it("is the identity at true scale", () => {
		const identity = pairs.map((pair) => ({
			display: pair.true,
			true: pair.true,
		}))
		for (const km of [10, 1000, 5000, 64000, 1e6]) {
			expect(equivalentTrueKm(km, identity)).toBeCloseTo(km)
		}
	})

	it("hits every planet exactly and interpolates in log space between them", () => {
		for (const pair of pairs) {
			expect(equivalentTrueKm(pair.display, pairs)).toBeCloseTo(pair.true)
		}
		// halfway in log(display) between 100 and 200 is halfway in log(true)
		expect(equivalentTrueKm(Math.SQRT2 * 100, pairs)).toBeCloseTo(
			Math.sqrt(1000 * 8000),
		)
	})

	it("scales by the nearest planet outside them", () => {
		expect(equivalentTrueKm(50, pairs)).toBeCloseTo(500)
		expect(equivalentTrueKm(800, pairs)).toBeCloseTo(128000)
	})

	it("survives no planets and zero distances", () => {
		expect(equivalentTrueKm(42, [])).toBe(42)
		expect(equivalentTrueKm(0, pairs)).toBe(0)
	})
})

describe("probeCamera", () => {
	const displayOf = (
		frame: ReturnType<typeof createSimFrame>,
		id: string,
	): [number, number, number] => {
		const i = frame.index.get(id)! * 3
		return [frame.displayKm[i], frame.displayKm[i + 1], frame.displayKm[i + 2]]
	}
	const trueAu = (frame: ReturnType<typeof createSimFrame>, id: string) => {
		const i = frame.index.get(id)! * 3
		const s = frame.index.get("sun")! * 3
		return (
			Math.hypot(
				frame.positionsKm[i] - frame.positionsKm[s],
				frame.positionsKm[i + 1] - frame.positionsKm[s + 1],
				frame.positionsKm[i + 2] - frame.positionsKm[s + 2],
			) / AU_KM
		)
	}

	it.each(SCALE_PRESET_IDS)(
		"a camera at a drawn planet is as far out as that planet really is (%s)",
		(preset) => {
			const frame = createSimFrame(bodies, 2461300.5, SCALE_PRESETS[preset])
			for (const id of ["mercury", "earth", "jupiter", "neptune"]) {
				expect(probeCamera(frame, ...displayOf(frame, id))).toBeCloseTo(
					trueAu(frame, id),
					2,
				)
			}
		},
	)

	it("reads a camera beyond drawn Neptune as the cold outer dark", () => {
		const frame = createSimFrame(
			bodies,
			2461300.5,
			SCALE_PRESETS.everythingVisible,
		)
		const [x, y, z] = displayOf(frame, "neptune")
		expect(probeCamera(frame, x * 3, y * 3, z * 3)).toBeGreaterThan(60)
	})
})

describe("bodyNoteHz", () => {
	it("falls from Mercury to Neptune, the Sun lowest", () => {
		const planets = bodies.filter((body) => body.kind === "planet")
		expect(planets.map((p) => p.id)).toEqual(Object.keys(PLANET_NOTES_HZ))
		const notes = planets.map((planet) => bodyNoteHz(planet.id))
		for (let i = 1; i < notes.length; i++) {
			expect(notes[i]).toBeLessThan(notes[i - 1])
		}
		expect(bodyNoteHz("sun")).toBe(SUN_NOTE_HZ)
		expect(SUN_NOTE_HZ).toBeLessThan(Math.min(...notes))
	})

	it("rings a moon an octave above its planet", () => {
		expect(bodyNoteHz("moon")).toBe(PLANET_NOTES_HZ.earth * 2)
		expect(bodyNoteHz("io")).toBe(PLANET_NOTES_HZ.jupiter * 2)
		expect(bodyNoteHz("nowhere")).toBeGreaterThan(0)
	})
})

describe("whooshShape", () => {
	it("starts and ends silent and peaks inside the crossing", () => {
		const shape = whooshShape(0.2, 0.8)
		expect(shape[0]).toMatchObject({ t: 0, gain: 0 })
		expect(shape.at(-1)).toMatchObject({ t: 1, gain: 0 })
		const peak = shape.reduce((a, b) => (b.gain > a.gain ? b : a))
		expect(peak.t).toBeGreaterThan(0.2)
		expect(peak.t).toBeLessThan(0.8)
		for (let i = 1; i < shape.length; i++) {
			expect(shape[i].t).toBeGreaterThanOrEqual(shape[i - 1].t)
			expect(shape[i].hz).toBeGreaterThan(0)
		}
	})

	it("keeps its points in order for odd windows", () => {
		const shape = whooshShape(0.9, 0.1)
		for (let i = 1; i < shape.length; i++) {
			expect(shape[i].t).toBeGreaterThanOrEqual(shape[i - 1].t)
		}
		expect(whooshShape(Number.NaN, Number.NaN)[1].t).toBe(0.25)
	})
})
