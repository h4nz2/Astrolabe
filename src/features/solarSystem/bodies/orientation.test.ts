import { describe, expect, it } from "vitest"
import { Quaternion, SphereGeometry, Vector3 } from "three"

import { bodies, getBody } from "@/data"
import {
	buildIndex,
	computePositions,
	dateToJD,
	equatorNode,
	rotationAngle,
	spinAxis,
} from "@/sim"

import {
	bodyOrientation,
	bodySpinAngle,
	bodySurfaceOrientation,
	createBodySpin,
} from "./orientation"

const expectVec = (actual: Vector3, expected: Vector3, digits = 9): void => {
	expect(actual.x).toBeCloseTo(expected.x, digits)
	expect(actual.y).toBeCloseTo(expected.y, digits)
	expect(actual.z).toBeCloseTo(expected.z, digits)
}

describe("bodyOrientation", () => {
	for (const id of ["earth", "uranus", "venus", "moon", "io", "phobos"]) {
		it(`maps local +Y to the spin axis and +X to the equator node for ${id}`, () => {
			const body = getBody(id)
			const q = bodyOrientation(body)
			const axis = new Vector3()
			const node = new Vector3()
			spinAxis(body.rotation, body.orbit, axis)
			equatorNode(body.rotation, body.orbit, node)
			expectVec(new Vector3(0, 1, 0).applyQuaternion(q), axis)
			expectVec(new Vector3(1, 0, 0).applyQuaternion(q), node)
			expect(q.length()).toBeCloseTo(1, 12)
		})
	}

	it("keeps Earth's pole 23.44 deg from the ecliptic pole, leaning toward -Z", () => {
		const up = new Vector3(0, 1, 0).applyQuaternion(
			bodyOrientation(getBody("earth")),
		)
		expect((Math.acos(up.y) * 180) / Math.PI).toBeCloseTo(23.4393, 3)
		expect(up.z).toBeLessThan(0)
		expect(Math.abs(up.x)).toBeLessThan(1e-6)
	})

	it("lays Uranus's IAU north pole 82 deg from the ecliptic pole, just north", () => {
		// the data keeps the tilt to the IAU north pole (180 - 97.77) and marks the
		// retrograde spin with the negative period, so north-up maps stay upright
		const up = new Vector3(0, 1, 0).applyQuaternion(
			bodyOrientation(getBody("uranus")),
		)
		expect((Math.acos(up.y) * 180) / Math.PI).toBeGreaterThan(80)
		expect((Math.acos(up.y) * 180) / Math.PI).toBeLessThan(85)
		expect(up.y).toBeGreaterThan(0)
		expect(getBody("uranus").rotation.periodHours).toBeLessThan(0)
	})

	it("reuses the given quaternion", () => {
		const body = getBody("mars")
		const q = bodyOrientation(body)
		expect(bodyOrientation(body, q)).toBe(q)
	})
})

const index = buildIndex(bodies)
const RAD = 180 / Math.PI

/** The positions and spin time BodyMesh reads, at `date`; `spinJD` defaults to the date (realistic). */
const frameAt = (date: string, spinJD?: number) => {
	const jd = dateToJD(new Date(date))
	return {
		index,
		positionsKm: computePositions(bodies, jd, undefined, index),
		spinJD: spinJD ?? jd,
	}
}

/**
 * Where the direction from body `id` toward body `targetId` meets the body's
 * texture: surface longitude (east positive) and latitude, degrees.
 */
const surfacePointToward = (
	id: string,
	targetId: string,
	frame: ReturnType<typeof frameAt>,
) => {
	const body = getBody(id)
	const i = index.get(id) ?? -1
	const j = index.get(targetId) ?? -1
	const p = frame.positionsKm
	const toward = new Vector3(
		p[j * 3] - p[i * 3],
		p[j * 3 + 1] - p[i * 3 + 1],
		p[j * 3 + 2] - p[i * 3 + 2],
	).normalize()
	const angle = bodySpinAngle(body, createBodySpin(body, i, frame), frame)
	const surface = bodySurfaceOrientation(bodyOrientation(body), angle)
	const local = toward.applyQuaternion(surface.invert())
	return {
		// SphereGeometry: u = 0.5 (longitude 0) at +X, east (u = 0.75) at -Z
		lonDeg: Math.atan2(-local.z, local.x) * RAD,
		latDeg: Math.asin(local.y) * RAD,
	}
}

describe("texture alignment", () => {
	it("SphereGeometry puts longitude 0 on +X, 90 E on -Z and the north pole on +Y", () => {
		const sphere = new SphereGeometry(1, 4, 4)
		const position = sphere.getAttribute("position")
		const uv = sphere.getAttribute("uv")
		for (let v = 0; v < position.count; v++) {
			const y = position.getY(v)
			// the poles have no longitude, the equator row no hemisphere
			if (Math.abs(y) > 0.99 || Math.abs(y) < 1e-9) continue
			const u = uv.getX(v)
			const x = position.getX(v)
			const z = position.getZ(v)
			// u = 0 is longitude -180, u = 1 is +180
			const lon = Math.atan2(-z, x) * RAD
			const expected = u * 360 - 180
			const diff = ((lon - expected + 540) % 360) - 180
			expect(Math.abs(diff)).toBeLessThan(1e-6)
			expect(uv.getY(v) > 0.5).toBe(y > 0)
		}
	})

	it("puts the noon Sun over Greenwich at 12:00 UTC", () => {
		// the equation of time moves true noon by at most 16.5 min (4.1 deg)
		for (const date of [
			"2024-03-20T12:00:00Z",
			"2025-06-21T12:00:00Z",
			"2026-11-03T12:00:00Z",
		]) {
			const { lonDeg } = surfacePointToward("earth", "sun", frameAt(date))
			expect(Math.abs(lonDeg)).toBeLessThan(4.5)
		}
		// and over 180 deg at midnight, over 90 E at 06:00 UTC
		const midnight = surfacePointToward(
			"earth",
			"sun",
			frameAt("2024-03-20T00:00:00Z"),
		)
		expect(180 - Math.abs(midnight.lonDeg)).toBeLessThan(4.5)
		const morning = surfacePointToward(
			"earth",
			"sun",
			frameAt("2024-03-20T06:00:00Z"),
		)
		expect(Math.abs(morning.lonDeg - 90)).toBeLessThan(4.5)
	})
})

describe("seasons from the tilt", () => {
	it("puts the Sun over the tropics at Earth's solstices and over the equator at its equinoxes", () => {
		const june = surfacePointToward(
			"earth",
			"sun",
			frameAt("2025-06-21T03:00:00Z"),
		)
		expect(june.latDeg).toBeCloseTo(23.44, 0)
		const december = surfacePointToward(
			"earth",
			"sun",
			frameAt("2025-12-21T15:00:00Z"),
		)
		expect(december.latDeg).toBeCloseTo(-23.44, 0)
		const march = surfacePointToward(
			"earth",
			"sun",
			frameAt("2025-03-20T09:00:00Z"),
		)
		expect(Math.abs(march.latDeg)).toBeLessThan(0.5)
	})

	it("points a pole of Uranus almost at the Sun near its solstices", () => {
		// southern summer at the 1986 Voyager 2 flyby, northern summer around 2030
		const voyager = surfacePointToward(
			"uranus",
			"sun",
			frameAt("1986-01-24T00:00:00Z"),
		)
		expect(voyager.latDeg).toBeLessThan(-75)
		const north = surfacePointToward(
			"uranus",
			"sun",
			frameAt("2030-06-01T00:00:00Z"),
		)
		expect(north.latDeg).toBeGreaterThan(75)
	})

	it("gives Mars, Saturn and Neptune seasons too, and Jupiter almost none", () => {
		const extreme = (id: string, periodDays: number) => {
			let max = 0
			for (let k = 0; k < 96; k++) {
				const date = new Date(
					Date.UTC(2000, 0, 1) + ((k * periodDays) / 96) * 86400000,
				)
				const { latDeg } = surfacePointToward(
					id,
					"sun",
					frameAt(date.toISOString()),
				)
				max = Math.max(max, Math.abs(latDeg))
			}
			return max
		}
		expect(extreme("mars", 687)).toBeCloseTo(25.19, 0)
		expect(extreme("saturn", 10759)).toBeCloseTo(26.7, 0)
		expect(extreme("neptune", 60190)).toBeCloseTo(28.32, 0)
		expect(extreme("jupiter", 4333)).toBeLessThan(3.5)
	})
})

describe("bodySpinAngle", () => {
	const spinOf = (id: string, frame: ReturnType<typeof frameAt>) => {
		const body = getBody(id)
		const i = index.get(id) ?? -1
		return bodySpinAngle(body, createBodySpin(body, i, frame), frame)
	}

	it("turns a planet by rotationAngle at the frame's spin time, not the simulation time", () => {
		const frame = frameAt("2025-01-01T00:00:00Z", 2451545.25)
		expect(spinOf("mars", frame)).toBe(
			rotationAngle(getBody("mars").rotation, 2451545.25),
		)
	})

	it("turns Venus and Uranus backwards (retrograde) and Earth forwards", () => {
		const a = frameAt("2025-01-01T00:00:00Z")
		const b = { ...a, spinJD: a.spinJD + 0.01 }
		expect(spinOf("earth", b)).toBeGreaterThan(spinOf("earth", a))
		expect(spinOf("venus", b)).toBeLessThan(spinOf("venus", a))
		expect(spinOf("uranus", b)).toBeLessThan(spinOf("uranus", a))
	})

	for (const [moon, planet] of [
		["moon", "earth"],
		["io", "jupiter"],
		["ganymede", "jupiter"],
		["titan", "saturn"],
		["triton", "neptune"],
		["deimos", "mars"],
	]) {
		it(`keeps ${moon}'s prime meridian toward ${planet} in every spin mode`, () => {
			for (const date of ["2025-01-01T00:00:00Z", "2025-01-09T07:30:00Z"]) {
				for (const spinJD of [undefined, 2451545]) {
					const { lonDeg } = surfacePointToward(
						moon,
						planet,
						frameAt(date, spinJD),
					)
					expect(Math.abs(lonDeg)).toBeLessThan(1e-6)
				}
			}
		})
	}

	it("lets bodies without a known period stand still", () => {
		const body = getBody("hyperion")
		expect(body.rotation.periodHours).toBeNull()
		expect(spinOf("hyperion", frameAt("2025-01-01T00:00:00Z"))).toBe(0)
	})
})

describe("bodySurfaceOrientation", () => {
	it("is the pole frame for no spin and turns the prime meridian eastward", () => {
		const pole = bodyOrientation(getBody("earth"))
		expect(bodySurfaceOrientation(pole, 0).angleTo(pole)).toBeCloseTo(0, 9)
		const q = bodySurfaceOrientation(pole, Math.PI / 2, new Quaternion())
		const meridian = new Vector3(1, 0, 0).applyQuaternion(q)
		const east = new Vector3(0, 0, -1).applyQuaternion(pole)
		expect(meridian.distanceTo(east)).toBeCloseTo(0, 9)
	})
})
