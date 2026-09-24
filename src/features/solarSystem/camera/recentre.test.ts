import { describe, expect, it } from "vitest"

import { bodies } from "@/data"
import { AU_KM, J2000_JD, SCALE_PRESETS } from "@/sim"

import { createSimFrame, type SimFrame } from "../scene/simFrame"
import {
	NEIGHBOURHOOD_MIN_RADII,
	SNAP_FOV_FRACTION,
	neighbourhoodOf,
	neighbourhoodRadiusKm,
	pointDisplayKm,
	pointOffsetKm,
	snapTarget,
} from "./recentre"

const trueFrame = createSimFrame(bodies, J2000_JD)
const visibleFrame = createSimFrame(
	bodies,
	J2000_JD,
	SCALE_PRESETS.everythingVisible,
)
const frames = [
	["true scale", trueFrame],
	["everything visible", visibleFrame],
] as const

const at = (frame: SimFrame, id: string): number => frame.index.get(id)!
const drawnKm = (frame: SimFrame, id: string): [number, number, number] => {
	const i = at(frame, id) * 3
	return [frame.displayKm[i], frame.displayKm[i + 1], frame.displayKm[i + 2]]
}
const plus = (
	a: readonly number[],
	b: readonly number[],
): [number, number, number] => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

describe("point views are kept in true km and drawn through the scale engine", () => {
	it.each(frames)("round-trips a drawn point under %s", (_name, frame) => {
		for (const [id, offset] of [
			["sun", [2.1e8, 1e6, -4e7]],
			["earth", [3e5, 0, 1e5]],
			["jupiter", [-5e6, 2e5, 0]],
			["moon", [1e3, 2e3, 0]],
		] as const) {
			const drawn = pointDisplayKm(
				frame,
				at(frame, id),
				offset,
				new Float64Array(3),
			)
			const back = pointOffsetKm(
				frame,
				at(frame, id),
				drawn,
				new Float64Array(3),
			)
			for (let k = 0; k < 3; k++) {
				expect(Math.abs(back[k] - offset[k])).toBeLessThan(1e-6 * 3e8)
			}
		}
	})

	it("is where the anchor's moons are drawn: a point at the Moon's true offset is drawn on the Moon", () => {
		const earth = at(visibleFrame, "earth")
		const moon = at(visibleFrame, "moon")
		const offset = [0, 1, 2].map(
			(k) =>
				visibleFrame.positionsKm[moon * 3 + k] -
				visibleFrame.positionsKm[earth * 3 + k],
		)
		const drawn = pointDisplayKm(
			visibleFrame,
			earth,
			offset,
			new Float64Array(3),
		)
		const moonDrawn = drawnKm(visibleFrame, "moon")
		expect(Math.hypot(...drawn.map((v, k) => v - moonDrawn[k]))).toBeLessThan(
			1e-3,
		)
	})
})

describe("neighbourhoodOf", () => {
	it.each(frames)(
		"finds the innermost body that owns a point under %s",
		(_name, frame) => {
			// right next to Earth: Earth; right next to the Moon: the Moon
			const earthR = frame.displayRadiiKm[at(frame, "earth")]
			expect(
				neighbourhoodOf(
					frame,
					plus(drawnKm(frame, "earth"), [0, 2 * earthR, 0]),
				),
			).toBe(at(frame, "earth"))
			const moonR = frame.displayRadiiKm[at(frame, "moon")]
			expect(
				neighbourhoodOf(frame, plus(drawnKm(frame, "moon"), [0, 2 * moonR, 0])),
			).toBe(at(frame, "moon"))
			// between the orbits of Mars and Jupiter: the Sun
			expect(neighbourhoodOf(frame, [0, 0, 0])).toBe(at(frame, "sun"))
			const belt = pointDisplayKm(
				frame,
				at(frame, "sun"),
				[0, 0, 2.8 * AU_KM],
				new Float64Array(3),
			)
			expect(neighbourhoodOf(frame, belt)).toBe(at(frame, "sun"))
		},
	)

	it("gives a planet its Hill sphere, which holds all its moons, and the Sun everything", () => {
		for (const frame of [trueFrame, visibleFrame]) {
			expect(neighbourhoodRadiusKm(frame, at(frame, "sun"))).toBe(Infinity)
			for (const planet of ["earth", "mars", "jupiter", "saturn"]) {
				const radius = neighbourhoodRadiusKm(frame, at(frame, planet))
				expect(radius).toBeGreaterThanOrEqual(
					NEIGHBOURHOOD_MIN_RADII * frame.displayRadiiKm[at(frame, planet)],
				)
				const centre = drawnKm(frame, planet)
				for (const moon of bodies.filter((b) => b.parentId === planet)) {
					const m = drawnKm(frame, moon.id)
					expect(Math.hypot(...m.map((v, k) => v - centre[k]))).toBeLessThan(
						radius,
					)
				}
			}
		}
	})
})

describe("snapTarget", () => {
	const fov = 45
	const all = () => true
	/** A camera `distance` km from `pivot` along +z. */
	const cameraAt = (pivot: readonly number[], distance: number) =>
		plus(pivot, [0, 0, distance])

	it("lands on the body the centre of the screen is on", () => {
		const jupiter = drawnKm(trueFrame, "jupiter")
		const r = trueFrame.displayRadiiKm[at(trueFrame, "jupiter")]
		// pivot inside the disc, camera 10 radii away
		const pivot = plus(jupiter, [0.5 * r, 0, 0])
		expect(
			snapTarget(trueFrame, cameraAt(pivot, 10 * r), pivot, fov, all),
		).toBe(at(trueFrame, "jupiter"))
	})

	it("lands on a speck within a few pixels of the centre, not on one further away", () => {
		const earth = drawnKm(trueFrame, "earth")
		const d = 1e8
		const snap = (SNAP_FOV_FRACTION * fov * Math.PI) / 180
		const near = plus(earth, [0.5 * snap * d, 0, 0])
		expect(snapTarget(trueFrame, cameraAt(near, d), near, fov, all)).toBe(
			at(trueFrame, "earth"),
		)
		const far = plus(earth, [3 * snap * d, 0, 0])
		// the Moon is within 0.4e6 km of Earth; far enough is further than that
		expect(snapTarget(trueFrame, cameraAt(far, d), far, fov, all)).toBe(-1)
	})

	it("ignores bodies that are not drawn and bodies behind the camera", () => {
		const earth = drawnKm(trueFrame, "earth")
		const earthIndex = at(trueFrame, "earth")
		// Earth sits on the ray between the camera and the pivot
		const pivot = plus(earth, [0, 0, -1e5])
		const camera = plus(earth, [0, 0, 1e6])
		expect(snapTarget(trueFrame, camera, pivot, fov, all)).toBe(earthIndex)
		expect(
			snapTarget(trueFrame, camera, pivot, fov, (i) => i !== earthIndex),
		).not.toBe(earthIndex)
		// turned round, Earth is behind the camera
		const away = plus(camera, [0, 0, 1e6])
		expect(snapTarget(trueFrame, camera, away, fov, all)).not.toBe(earthIndex)
	})
})
