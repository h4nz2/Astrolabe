import { describe, expect, it } from "vitest"
import { encode } from "uqr"

import { qrCode, qrPath } from "./qr"

/** The dark modules a path covers, by replaying its rectangles. */
const covered = (path: string): Set<string> => {
	const cells = new Set<string>()
	for (const [, x, y, w] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
		for (let i = 0; i < Number(w); i += 1) {
			cells.add(`${Number(x) + i},${y}`)
		}
	}
	return cells
}

describe("qrPath", () => {
	it("draws each horizontal run of dark modules as one rectangle", () => {
		expect(
			qrPath([
				[true, true, false, true],
				[false, false, false, false],
				[false, true, true, true],
			]),
		).toBe("M0 0h2v1h-2zM3 0h1v1h-1zM1 2h3v1h-3z")
		expect(qrPath([[false, false]])).toBe("")
	})
})

describe("qrCode", () => {
	it("covers exactly the encoder's dark modules, quiet zone included", () => {
		const link =
			"https://example.org/solar_system?focus=earth&frame=earth&sel=mars&cam=0_89.9_120&t=2460691.5&warp=2629800&paused=true&present=true&lang=de&reading=simple"
		const code = qrCode(link)
		const { data, size } = encode(link, { ecc: "M", border: 4 })
		expect(code.size).toBe(size)
		const dark = new Set<string>()
		data.forEach((row, y) =>
			row.forEach((on, x) => {
				if (on) dark.add(`${x},${y}`)
			}),
		)
		expect(covered(code.path)).toEqual(dark)
		// the four-module quiet zone is light
		for (let i = 0; i < size; i += 1) {
			expect(dark.has(`${i},0`)).toBe(false)
			expect(dark.has(`0,${i}`)).toBe(false)
		}
	})
})
