import { describe, expect, it } from "vitest"
import { PerspectiveCamera, Vector3 } from "three"

import { bodies, moonsOf } from "@/data"
import { AU_KM, J2000_JD, degToRad, toUnits } from "@/sim"

import {
	MARKER_HIDE_DIAMETER_PX,
	MARKER_PICK_RADIUS_PX,
	createMarkerBuffers,
	fillMarkers,
	isMoonDotShown,
	pickMarker,
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

describe("pickMarker", () => {
	const ANGLE_PER_PX = 1e-3
	const origin = new Vector3(0, 0, 0)
	const towards = (x: number, y: number, z: number) =>
		new Vector3(x, y, z).normalize()

	/** Jupiter, Io and Europa in a row 100 units ahead: 0, 5 and 30 px right of centre. */
	const trio = (): { buffers: MarkerBuffers; drawn: number } => {
		const buffers = createMarkerBuffers(3)
		buffers.positions.set([0, 0, -100, 0.5, 0, -100, 3, 0, -100])
		buffers.vertexBody.set([index("jupiter"), index("io"), index("europa")])
		return { buffers, drawn: 3 }
	}

	it("prefers a planet within the pick radius over a nearer moon", () => {
		const { buffers, drawn } = trio()
		expect(
			pickMarker(
				buffers,
				drawn,
				bodies,
				origin,
				towards(0, 0, -1),
				ANGLE_PER_PX,
			),
		).toBe(0)
		// aimed exactly at Io: Jupiter is 5 px away and still wins
		expect(
			pickMarker(
				buffers,
				drawn,
				bodies,
				origin,
				towards(0.5, 0, -100),
				ANGLE_PER_PX,
			),
		).toBe(0)
	})

	it("picks the nearest moon when no planet is within the radius", () => {
		const { buffers, drawn } = trio()
		// aimed 8 px left of Europa: Jupiter (22 px) and Io (17 px) are out of reach
		expect(
			pickMarker(
				buffers,
				drawn,
				bodies,
				origin,
				towards(2.2, 0, -100),
				ANGLE_PER_PX,
			),
		).toBe(2)
	})

	it("returns -1 when nothing is within the radius or everything is behind the eye", () => {
		const { buffers, drawn } = trio()
		expect(
			pickMarker(
				buffers,
				drawn,
				bodies,
				origin,
				towards(0, 1, 0),
				ANGLE_PER_PX,
			),
		).toBe(-1)
		expect(
			pickMarker(
				buffers,
				drawn,
				bodies,
				origin,
				towards(0, 0, 1),
				ANGLE_PER_PX,
			),
		).toBe(-1)
		expect(MARKER_PICK_RADIUS_PX).toBe(10)
	})

	it("from the Sun view 7 AU out, a click near Jupiter picks Jupiter, not one of its moons", () => {
		const frame = createSimFrame(bodies, J2000_JD)
		const jupiter = index("jupiter")
		const buffers = createMarkerBuffers(bodies.length)
		const camera = cameraAt(0, toUnits(7 * AU_KM), 0)
		const anglePerPx = 1 / PX_PER_UNIT

		// Sun focus: Jupiter's dot sits alone, 3 px off the pointer
		let drawn = fillMarkers(buffers, frame, camera, HEIGHT_PX, {
			showMoons: true,
			focusId: "sun",
		})
		const target = frame.renderPosition(jupiter, new Vector3())
		const direction = target.clone().sub(camera.position).normalize()
		direction.x += 3 * anglePerPx
		direction.normalize()
		let picked = pickMarker(
			buffers,
			drawn,
			bodies,
			camera.position,
			direction,
			anglePerPx,
		)
		expect(picked).toBeGreaterThanOrEqual(0)
		expect(buffers.vertexBody[picked]).toBe(jupiter)

		// Io focus (all Jovian moons drawn, a fraction of a pixel from Jupiter):
		// a click exactly on Io still goes to the planet
		const io = index("io")
		updateSimFrame(frame, J2000_JD, io)
		drawn = fillMarkers(buffers, frame, camera, HEIGHT_PX, {
			showMoons: true,
			focusId: "io",
		})
		expect(drawnBodies(buffers, drawn)).toContain(io)
		picked = pickMarker(
			buffers,
			drawn,
			bodies,
			camera.position,
			new Vector3(0, -1, 0),
			anglePerPx,
		)
		expect(buffers.vertexBody[picked]).toBe(jupiter)
	})
})
