import { describe, expect, it } from "vitest"

import { SURFACE_LOAD_PX, wantsSurface } from "./surfaceLoad"

describe("wantsSurface", () => {
	const pxPerUnit = 1000
	it("waits while the moon is a speck", () => {
		// 1 unit wide at 1000 units: 1 px
		expect(wantsSurface(1, 1000, pxPerUnit)).toBe(false)
	})
	it("fetches from SURFACE_LOAD_PX on", () => {
		expect(wantsSurface(SURFACE_LOAD_PX, 1000, pxPerUnit)).toBe(true)
		expect(wantsSurface(SURFACE_LOAD_PX * 0.99, 1000, pxPerUnit)).toBe(false)
	})
	it("fetches with the camera inside the sphere", () => {
		expect(wantsSurface(2, 1, pxPerUnit)).toBe(true)
	})
})
