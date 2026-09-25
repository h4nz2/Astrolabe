import { describe, expect, it } from "vitest"
import { PerspectiveCamera } from "three"

import { bodies, moonsOf } from "@/data"
import { J2000_JD, degToRad, toUnits } from "@/sim"

import {
	MARKER_HIDE_DIAMETER_PX,
	createMarkerBuffers,
	fillMarkers,
	isMoonDotShown,
	type MarkerBuffers,
} from "./Markers"
import { createSimFrame, updateSimFrame } from "./simFrame"

const HEIGHT_PX = 800
const FOV_DEG = 45
/** Pixels per scene unit at unit distance, as fillMarkers computes it. */
const PX_PER_UNIT = HEIGHT_PX / (2 * Math.tan(degToRad(FOV_DEG / 2)))
const index = (id: string): number => bodies.findIndex((b) => b.id === id)
const nonMoons = bodies.filter((b) => b.kind !== "moon").length

const cameraAt = (x: number, y: number, z: number): PerspectiveCamera => {
	const camera = new PerspectiveCamera(FOV_DEG, 1.5, 1e-5, 1e9)
	camera.position.set(x, y, z)
	camera.updateMatrixWorld()
	return camera
}

const drawnBodies = (buffers: MarkerBuffers, drawn: number): number[] =>
	Array.from(buffers.vertexBody.slice(0, drawn))

describe("isMoonDotShown", () => {
	it("shows a moon's dot only around the focus family", () => {
		const io = { id: "io", parentId: "jupiter" }
		expect(isMoonDotShown(io, "jupiter", "sun")).toBe(true)
		expect(isMoonDotShown(io, "europa", "jupiter")).toBe(true)
		expect(isMoonDotShown(io, "io", "jupiter")).toBe(true)
		expect(isMoonDotShown(io, "sun", null)).toBe(false)
		expect(isMoonDotShown(io, "earth", "sun")).toBe(false)
		expect(isMoonDotShown(io, "moon", "earth")).toBe(false)
	})
})

describe("fillMarkers", () => {
	it("draws the Sun and the planets from afar, moons only around the focus family", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const buffers = createMarkerBuffers(bodies.length)
		const far = cameraAt(0, toUnits(1e10), 0)

		// the Sun: no moon dots at all
		let drawn = fillMarkers(buffers, frame, far, HEIGHT_PX, {
			showMoons: true,
			focusId: "sun",
		})
		expect(drawn).toBe(nonMoons)
		const earth = index("earth")
		expect(drawnBodies(buffers, drawn)).toContain(earth)
		// planets white, the Sun yellow
		const earthVertex = drawnBodies(buffers, drawn).indexOf(earth)
		expect(
			Array.from(buffers.colors.slice(earthVertex * 3, earthVertex * 3 + 3)),
		).toEqual([1, 1, 1])
		expect(buffers.colors[0]).toBe(1)
		expect(buffers.colors[2]).toBeLessThan(1)
		expect(buffers.positions[earthVertex * 3]).toBeCloseTo(
			toUnits(frame.positionsKm[earth * 3]),
			2,
		)

		// Earth: its Moon joins, grey
		updateSimFrame(frame, J2000_JD, earth)
		drawn = fillMarkers(buffers, frame, far, HEIGHT_PX, {
			showMoons: true,
			focusId: "earth",
		})
		expect(drawn).toBe(nonMoons + moonsOf("earth").length)
		const moonVertex = drawnBodies(buffers, drawn).indexOf(index("moon"))
		expect(moonVertex).toBeGreaterThanOrEqual(0)
		expect(buffers.colors[moonVertex * 3]).toBeLessThan(1)

		// Io: every Jovian moon (siblings), none of Earth's
		updateSimFrame(frame, J2000_JD, index("io"))
		drawn = fillMarkers(buffers, frame, far, HEIGHT_PX, {
			showMoons: true,
			focusId: "io",
		})
		expect(drawn).toBe(nonMoons + moonsOf("jupiter").length)
		expect(drawnBodies(buffers, drawn)).toContain(index("europa"))
		expect(drawnBodies(buffers, drawn)).not.toContain(index("moon"))
	})

	it("skips moons while they are hidden, except the focus, and compacts the vertices", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const io = index("io")
		updateSimFrame(frame, J2000_JD, io)
		const buffers = createMarkerBuffers(bodies.length)
		const drawn = fillMarkers(
			buffers,
			frame,
			cameraAt(0, toUnits(1e10), 0),
			HEIGHT_PX,
			{ showMoons: false, focusId: "io" },
		)
		expect(drawn).toBe(nonMoons + 1)
		const ids = drawnBodies(buffers, drawn)
		expect(ids).toContain(io)
		expect(ids).not.toContain(index("europa"))
		for (let v = 0; v < drawn; v++) {
			const body = bodies[buffers.vertexBody[v]]
			expect(body.kind !== "moon" || body.id === "io").toBe(true)
		}
	})

	it("hides the dot of a body once its disc is wider than 6 px on screen", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const earth = index("earth")
		updateSimFrame(frame, J2000_JD, earth)
		const buffers = createMarkerBuffers(bodies.length)
		const radius = toUnits(bodies[earth].radiusKm)
		const state = { showMoons: true, focusId: "earth" }
		// 6 Earth radii away: Earth is ~150 px tall, well over the hide diameter
		let drawn = fillMarkers(
			buffers,
			frame,
			cameraAt(0, 0, 6 * radius),
			HEIGHT_PX,
			state,
		)
		expect(drawnBodies(buffers, drawn)).not.toContain(earth)
		// the Moon is already about 9 px wide from here and shows as a disc, no dot;
		// Mars is a fraction of a pixel and keeps its dot
		expect(drawnBodies(buffers, drawn)).not.toContain(index("moon"))
		expect(drawnBodies(buffers, drawn)).toContain(index("mars"))

		// the rule is on the diameter: 5 px wide keeps the dot, 7 px wide drops it
		const distanceFor = (diameterPx: number) =>
			(2 * radius * PX_PER_UNIT) / diameterPx
		drawn = fillMarkers(
			buffers,
			frame,
			cameraAt(0, 0, distanceFor(MARKER_HIDE_DIAMETER_PX - 1)),
			HEIGHT_PX,
			state,
		)
		expect(drawnBodies(buffers, drawn)).toContain(earth)
		drawn = fillMarkers(
			buffers,
			frame,
			cameraAt(0, 0, distanceFor(MARKER_HIDE_DIAMETER_PX + 1)),
			HEIGHT_PX,
			state,
		)
		expect(drawnBodies(buffers, drawn)).not.toContain(earth)
	})
})
