import { describe, expect, it } from "vitest"

import { MOTION_SETTLE_MS, MotionWatch } from "./motion"

const pose = (distance: number, azimuth = 0, polar = 1) => ({
	distance,
	azimuth,
	polar,
})

describe("MotionWatch", () => {
	it("is still on the first frame and while the pose holds", () => {
		const watch = new MotionWatch()
		expect(watch.update(0, pose(10), false)).toBe(false)
		expect(watch.update(16, pose(10), false)).toBe(false)
		expect(watch.update(1000, pose(10), false)).toBe(false)
	})

	it("moves while the pose changes and settles shortly after it stops", () => {
		const watch = new MotionWatch()
		watch.update(0, pose(10), false)
		expect(watch.update(16, pose(9), false)).toBe(true) // zoom
		expect(watch.update(32, pose(9, 0.1), false)).toBe(true) // orbit
		// a frame without change inside a drag does not flicker the controls back
		expect(watch.update(48, pose(9, 0.1), false)).toBe(true)
		expect(watch.update(32 + MOTION_SETTLE_MS + 1, pose(9, 0.1), false)).toBe(
			false,
		)
	})

	it("moves for as long as a transition runs, even between identical poses", () => {
		const watch = new MotionWatch()
		watch.update(0, pose(10), false)
		expect(watch.update(500, pose(10), true)).toBe(true)
		expect(watch.update(1000, pose(10), true)).toBe(true)
		expect(watch.update(1000 + MOTION_SETTLE_MS + 1, pose(10), false)).toBe(
			false,
		)
	})

	it("ignores changes too small to see (a camera following its body)", () => {
		const watch = new MotionWatch()
		watch.update(0, pose(10, 0.5, 1), false)
		expect(watch.update(16, pose(10 * (1 + 1e-6), 0.5 + 1e-6, 1), false)).toBe(
			false,
		)
	})
})
