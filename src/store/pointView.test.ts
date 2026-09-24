/** A free centre (#15) in the URL: `focus` is the anchor, `at` the offset in its true radii. */
import { describe, expect, it } from "vitest"

import { getBody } from "@/data"
import { AU_KM, J2000_JD } from "@/sim"

import { OVERVIEW, formatOffset, parseOffset, type View } from "./navigation"
import { simSearchSchema } from "./simSearch"
import { sameSearch, searchFromState, viewFromSearch } from "./urlSync"

const SUN_R = getBody("sun").radiusKm
const MARS_R = getBody("mars").radiusKm

describe("formatOffset / parseOffset", () => {
	it("writes the offset in true radii of the anchor, 4 significant digits of the largest component", () => {
		expect(formatOffset([2.8 * AU_KM, 0, -1e5], SUN_R)).toBe(
			`${Number(((2.8 * AU_KM) / SUN_R).toPrecision(4))}_0_-0.1`,
		)
		expect(formatOffset([10 * MARS_R, 0.5 * MARS_R, 0], MARS_R)).toBe(
			"10_0.5_0",
		)
		expect(formatOffset([0, 0, 0], MARS_R)).toBe("0_0_0")
		// never exponent notation, never -0
		expect(formatOffset([1e-3, -1e-9, 0], MARS_R)).not.toMatch(/e|-0(?!\.)/)
	})

	it("round-trips to within 1/1000 of the distance from the anchor", () => {
		for (const offset of [
			[2.8 * AU_KM, 1e6, -3e7],
			[-4e5, 2e3, 1e5],
			[1, 0, 0],
		] as const) {
			const back = parseOffset(formatOffset(offset, MARS_R), MARS_R)!
			const size = Math.hypot(...offset)
			for (let k = 0; k < 3; k++) {
				expect(Math.abs(back[k] - offset[k])).toBeLessThan(1e-3 * size)
			}
		}
	})

	it("ignores malformed values", () => {
		for (const text of [
			undefined,
			"",
			"1_2",
			"1_2_3_4",
			"a_b_c",
			"1__2",
			"1_2_Infinity",
		]) {
			expect(parseOffset(text, MARS_R)).toBeNull()
		}
	})
})

describe("a point view in the URL", () => {
	const mirrored = (view: View) =>
		searchFromState(
			{
				view,
				selectedId: null,
				shot: null,
				timeWarp: 1,
				paused: true,
				simTimeJD: J2000_JD,
				showOrbits: true,
				showLabels: true,
				showMoons: true,
				showMarkers: true,
			},
			{},
		)

	it("is written as its anchor and offset, and read back as the same point", () => {
		const view: View = {
			kind: "point",
			anchorId: "mars",
			offsetKm: [20 * MARS_R, 0, -5 * MARS_R],
		}
		const search = mirrored(view)
		expect(search.focus).toBe("mars")
		expect(search.at).toBe("20_0_-5")
		const back = viewFromSearch(simSearchSchema.parse({ ...search }))
		expect(back.view).toEqual(view)
		// a point in space selects nothing by itself
		expect(back.selectedId).toBeNull()
		expect(sameSearch(search, { ...search, at: "20_0_-4" })).toBe(false)
	})

	it("drops a bad `at` to the anchor body, and `at` without a known `focus` to the overview", () => {
		expect(viewFromSearch({ focus: "mars", at: "x" }).view).toEqual({
			kind: "body",
			id: "mars",
		})
		expect(viewFromSearch({ at: "1_2_3" }).view).toEqual(OVERVIEW)
		expect(viewFromSearch({ focus: "vulcan", at: "1_2_3" }).view).toEqual(
			OVERVIEW,
		)
		expect(mirrored({ kind: "body", id: "mars" }).at).toBeUndefined()
		expect(mirrored(OVERVIEW).at).toBeUndefined()
	})
})
