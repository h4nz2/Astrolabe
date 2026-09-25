import { describe, expect, it } from "vitest"

import {
	blendWeight,
	craftPhase,
	decodeTrajectory,
	eventsWithJD,
	isInSpace,
	isoToJD,
	lightTimeSeconds,
	pathTimes,
	segmentState,
} from "./spacecraft"
import { J2000_JD } from "./time"

describe("isoToJD", () => {
	it("is the Julian Date of the UTC instant", () => {
		expect(isoToJD("2000-01-01T12:00Z")).toBe(J2000_JD)
		expect(isoToJD("1977-09-05T12:56Z")).toBeCloseTo(2443392.03889, 4)
	})
})

describe("blendWeight", () => {
	it("is 1 inside, 0 outside, smooth and monotone between", () => {
		expect(blendWeight(10, 20, 5)).toBe(1)
		expect(blendWeight(10, 20, 10)).toBe(1)
		expect(blendWeight(10, 20, 20)).toBe(0)
		expect(blendWeight(10, 20, 30)).toBe(0)
		expect(blendWeight(10, 20, 15)).toBeCloseTo(0.5, 12)
		let last = 1
		for (let d = 10; d <= 20; d += 0.25) {
			const w = blendWeight(10, 20, d)
			expect(w).toBeLessThanOrEqual(last)
			last = w
		}
	})
	it("never blends a segment without radii", () => {
		expect(blendWeight(Infinity, Infinity, 1e12)).toBe(1)
	})
})

describe("craftPhase", () => {
	const voyager = { launch: "1977-09-05T12:56Z", end: null }
	const pioneer = {
		launch: "1972-03-03T01:49Z",
		end: { date: "2003-01-23T12:00Z", kind: "silent" as const },
	}
	const cassini = {
		launch: "1997-10-15T08:43Z",
		end: { date: "2017-09-15T10:31Z", kind: "destroyed" as const },
	}
	it("is planned before launch, active after", () => {
		expect(craftPhase(voyager, isoToJD("1977-01-01T00:00Z"))).toBe("planned")
		expect(craftPhase(voyager, isoToJD("2026-09-25T00:00Z"))).toBe("active")
	})
	it("shows an ended mission as ended, and how", () => {
		expect(craftPhase(pioneer, isoToJD("1990-01-01T00:00Z"))).toBe("active")
		expect(craftPhase(pioneer, isoToJD("2010-01-01T00:00Z"))).toBe("silent")
		expect(craftPhase(cassini, isoToJD("2020-01-01T00:00Z"))).toBe("destroyed")
		expect(isInSpace("silent")).toBe(true)
		expect(isInSpace("destroyed")).toBe(false)
		expect(isInSpace("planned")).toBe(false)
	})
})

describe("lightTimeSeconds", () => {
	it("is about 499 s for one astronomical unit", () => {
		expect(lightTimeSeconds([149597870.7, 0, 0], [0, 0, 0])).toBeCloseTo(
			499.005,
			2,
		)
	})
})

describe("decodeTrajectory", () => {
	const bodies = [
		{ parentId: null },
		{ parentId: "sun" },
		{ parentId: "earth" },
	]
	const index = new Map([
		["sun", 0],
		["earth", 1],
		["moon", 2],
	])
	const craft = {
		id: "probe",
		dataFrom: "2000-01-01T12:00Z",
		dataTo: "2000-01-11T12:00Z",
	}
	const segment = {
		center: "sun",
		blend: null,
		t: [0, 10],
		p: [1, 2, 3, 4, 5, 6],
		v: [0, 0, 0, 0, 0, 0],
	}

	it("maps the ecliptic (x, y, z) to the scene's (x, z, -y) and times to JDs", () => {
		const trajectory = decodeTrajectory(craft, [segment], bodies, index)
		const [helio] = trajectory.helio
		expect([...helio.p]).toEqual([1, 3, -2, 4, 6, -5])
		expect(helio.from).toBe(J2000_JD)
		expect(helio.to).toBe(J2000_JD + 10)
		expect(trajectory.fromJD).toBe(J2000_JD)
		expect(trajectory.toJD).toBe(J2000_JD + 10)
		const p = new Float64Array(3)
		segmentState(helio, J2000_JD, p)
		expect([...p]).toEqual([1, 3, -2])
	})

	it("sorts segments by centre: the Sun's apart from the planets'", () => {
		const trajectory = decodeTrajectory(
			craft,
			[{ ...segment, center: "earth", blend: [1, 2] }, segment],
			bodies,
			index,
		)
		expect(trajectory.helio.map((s) => s.center)).toEqual(["sun"])
		expect(trajectory.planetary.map((s) => s.center)).toEqual(["earth"])
		expect(trajectory.planetary[0].inner).toBe(1)
	})

	it("refuses centres that are neither the root nor its children", () => {
		expect(() =>
			decodeTrajectory(craft, [{ ...segment, center: "moon" }], bodies, index),
		).toThrow(/root or orbit it/)
		expect(() =>
			decodeTrajectory(craft, [{ ...segment, center: "pluto" }], bodies, index),
		).toThrow(/unknown centre/)
	})
})

describe("pathTimes", () => {
	it("keeps every sample and subdivides where the path turns fast", () => {
		const bodies = [{ parentId: null }]
		const index = new Map([["sun", 0]])
		const trajectory = decodeTrajectory(
			{ id: "x", dataFrom: "2000-01-01T12:00Z", dataTo: "2000-01-03T12:00Z" },
			[
				{
					center: "sun",
					blend: null,
					t: [0, 1, 2],
					// slow on the first day, 1000x faster on the second
					p: [1e6, 0, 0, 1e6, 0, 0, 1e6, 0, 0],
					v: [0, 0.01, 0, 0, 0.01, 0, 0, 10, 0],
				},
			],
			bodies,
			index,
		)
		const times = pathTimes(trajectory.helio, J2000_JD, J2000_JD + 2)
		expect(times[0]).toBe(J2000_JD)
		expect(times[times.length - 1]).toBe(J2000_JD + 2)
		const firstDay = times.filter((t) => t <= J2000_JD + 1).length
		const secondDay = times.filter((t) => t > J2000_JD + 1).length
		expect(secondDay).toBeGreaterThan(firstDay)
		for (let k = 1; k < times.length; k++) {
			expect(times[k]).toBeGreaterThan(times[k - 1])
		}
	})
})

describe("eventsWithJD", () => {
	it("orders events by time", () => {
		const events = eventsWithJD([
			{ date: "1980-01-01T00:00Z", kind: "flyby", target: "saturn" },
			{ date: "1979-01-01T00:00Z", kind: "flyby", target: "jupiter" },
		])
		expect(events.map((e) => e.target)).toEqual(["jupiter", "saturn"])
		expect(events[0].jd).toBe(isoToJD("1979-01-01T00:00Z"))
	})
})
