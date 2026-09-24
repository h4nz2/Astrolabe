import { describe, expect, it } from "vitest"

import { getBody } from "@/data"
import { AU_KM, degToRad, toUnits } from "@/sim"
import { HOME_SHOT } from "@/store/navigation"

import { FRAMING_RADII, overviewDistance, renderedRadius } from "./framing"
import {
	MAX_TRANSIT_MS,
	MIN_TRANSIT_MS,
	createPose,
	easeInOutCubic,
	lerpAngle,
	poseToShot,
	resolveShot,
	shotToPose,
	transitDurationMs,
	ZOOM_PAN_RHO,
	wrapPi,
	zoomPanAt,
	zoomPanLength,
	type ZoomPanSample,
} from "./pose"
import {
	DEFAULT_PROFILE,
	smoothProfile,
	transitProfile,
	type TransitInput,
	type TransitSample,
} from "./profiles"

const K = 2 * Math.tan(degToRad(22.5))
const framing = (id: string) => FRAMING_RADII * renderedRadius(getBody(id))

describe("angles and easing", () => {
	it("wraps into [-pi, pi) and blends the short way round", () => {
		expect(wrapPi(3 * Math.PI)).toBeCloseTo(-Math.PI, 12)
		expect(wrapPi(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 12)
		// from 170 to -170 degrees crosses 180, not 0
		const a = degToRad(170)
		const b = degToRad(-170)
		expect(lerpAngle(a, b, 0.5)).toBeCloseTo(Math.PI, 12)
		expect(lerpAngle(a, b, 1) - b).toBeCloseTo(2 * Math.PI, 12)
	})

	it("eases from 0 to 1 symmetrically", () => {
		expect(easeInOutCubic(0)).toBe(0)
		expect(easeInOutCubic(1)).toBe(1)
		expect(easeInOutCubic(0.5)).toBe(0.5)
		expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1, 12)
	})
})

describe("shots and poses", () => {
	it("converts a shot to camera-controls' spherical pose and back", () => {
		const pose = shotToPose(
			{ azimuthDeg: 30, elevationDeg: 20, distance: 2 },
			100,
			createPose(),
		)
		expect(pose.radius).toBe(200)
		expect(pose.theta).toBeCloseTo(degToRad(30), 12)
		expect(pose.phi).toBeCloseTo(degToRad(70), 12)
		const shot = poseToShot(pose, 100)
		expect(shot.azimuthDeg).toBeCloseTo(30, 10)
		expect(shot.elevationDeg).toBeCloseTo(20, 10)
		expect(shot.distance).toBeCloseTo(2, 12)
	})

	it("keeps the current direction where a request leaves it out", () => {
		const current = shotToPose(HOME_SHOT, 50, createPose())
		const out = resolveShot({ distance: 3 }, current, 10, createPose())
		expect(out).toEqual({ radius: 30, theta: current.theta, phi: current.phi })
		const turned = resolveShot({ elevationDeg: 90 }, current, 10, createPose())
		expect(turned.radius).toBe(10)
		expect(turned.phi).toBeCloseTo(0, 12)
		expect(turned.theta).toBe(current.theta)
	})
})

describe("zoom-and-pan path", () => {
	const cases: [string, number, number, number][] = [
		// w0, w1, d in scene units
		["overview to Jupiter", K * 1.2e7, K * framing("jupiter"), 7.8e5],
		["Earth to Neptune", K * framing("earth"), K * framing("neptune"), 4.5e6],
		["Io to Europa", K * framing("io"), K * framing("europa"), 250],
		["same size, short hop", 10, 10, 1],
		[
			"tiny moon to Neptune",
			K * framing("s2009s1"),
			K * framing("neptune"),
			4.5e6,
		],
	]

	it.each(cases)(
		"starts and ends exactly on both views: %s",
		(_, w0, w1, d) => {
			const length = zoomPanLength(w0, w1, d)
			expect(length).toBeGreaterThan(0)
			const out: ZoomPanSample = { u: 0, w: 0 }
			zoomPanAt(0, w0, w1, d, out)
			expect(out.u).toBeCloseTo(0, 6)
			expect(out.w / w0).toBeCloseTo(1, 9)
			zoomPanAt(length, w0, w1, d, out)
			expect(out.u / d).toBeCloseTo(1, 6)
			expect(out.w / w1).toBeCloseTo(1, 6)
		},
	)

	it("backs out until both ends are in view on a long trip (pull back, travel, descend)", () => {
		const w0 = K * framing("earth")
		const w1 = K * framing("neptune")
		const d = toUnits(30 * AU_KM)
		const length = zoomPanLength(w0, w1, d)
		const out: ZoomPanSample = { u: 0, w: 0 }
		let peak = 0
		let peakAt = 0
		let peakU = 0
		const steps = 200
		let previousU = 0
		for (let i = 0; i <= steps; i++) {
			zoomPanAt((length * i) / steps, w0, w1, d, out)
			expect(out.u).toBeGreaterThanOrEqual(previousU - 1e-6 * d)
			previousU = out.u
			if (out.w > peak) {
				peak = out.w
				peakAt = i / steps
				peakU = out.u
			}
		}
		// at the top both planets are on screen, well inside the edge (w is the
		// visible height at the pivot, and the pivot is between them)
		expect(peak / 2).toBeGreaterThan(1.1 * Math.max(peakU, d - peakU))
		expect(peakAt).toBeGreaterThan(0.3)
		expect(peakAt).toBeLessThan(0.7)
		// most of the travel happens near the top, not while close to either planet
		zoomPanAt(length * 0.25, w0, w1, d, out)
		expect(out.u / d).toBeLessThan(0.1)
		zoomPanAt(length * 0.75, w0, w1, d, out)
		expect(out.u / d).toBeGreaterThan(0.9)
	})

	it("is a pure zoom when the pivot does not move", () => {
		expect(zoomPanLength(100, 1, 0)).toBeCloseTo(
			Math.log(100) / ZOOM_PAN_RHO,
			12,
		)
		const out: ZoomPanSample = { u: 0, w: 0 }
		zoomPanAt(zoomPanLength(100, 1, 0) / 2, 100, 1, 0, out)
		expect(out.u).toBe(0)
		expect(out.w).toBeCloseTo(10, 9)
		expect(zoomPanLength(5, 5, 0)).toBe(0)
	})
})

describe("smooth transit profile", () => {
	const input = (
		fromDistance: number,
		toDistance: number,
		separation: number,
	): TransitInput => ({
		fromDistance,
		toDistance,
		separation,
		widthPerDistance: K,
	})

	it("starts on the start pose and ends exactly on the destination", () => {
		const cases = [
			input(overviewDistance(45, 16 / 9), framing("jupiter"), 7.8e5),
			input(framing("earth"), framing("neptune"), 4.5e6),
			input(framing("sun"), overviewDistance(45, 1), 0),
		]
		const out: TransitSample = { pivot: 0, distance: 0, direction: 0 }
		for (const case_ of cases) {
			smoothProfile.sample(0, case_, out)
			expect(out.pivot).toBe(0)
			expect(out.direction).toBe(0)
			expect(out.distance / case_.fromDistance).toBeCloseTo(1, 9)
			smoothProfile.sample(1, case_, out)
			expect(out).toEqual({
				pivot: 1,
				distance: case_.toDistance,
				direction: 1,
			})
		}
	})

	it("keeps the destination on screen while descending from the overview", () => {
		const from = overviewDistance(45, 16 / 9)
		const to = framing("jupiter")
		const separation = toUnits(5.2 * AU_KM)
		const out: TransitSample = { pivot: 0, distance: 0, direction: 0 }
		for (let t = 0; t <= 1; t += 0.01) {
			smoothProfile.sample(t, input(from, to, separation), out)
			// Jupiter's distance from the pivot is within the visible half height
			const offCentre = (1 - out.pivot) * separation
			expect(offCentre).toBeLessThanOrEqual((out.distance * K) / 2 + 1e-6)
		}
	})

	it("is the default and the fallback for unknown names", () => {
		expect(transitProfile(null)).toBe(smoothProfile)
		expect(transitProfile(DEFAULT_PROFILE)).toBe(smoothProfile)
		expect(transitProfile("warp-drive")).toBe(smoothProfile)
		expect(transitProfile("toString")).toBe(smoothProfile)
	})
})

describe("transitDurationMs", () => {
	it("grows with the length of the move within its bounds", () => {
		expect(transitDurationMs(0)).toBe(0)
		expect(transitDurationMs(0.5)).toBe(MIN_TRANSIT_MS)
		expect(transitDurationMs(1e3)).toBe(MAX_TRANSIT_MS)
		expect(transitDurationMs(8)).toBeGreaterThan(transitDurationMs(5))
	})
})
