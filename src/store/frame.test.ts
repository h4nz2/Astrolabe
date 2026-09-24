/**
 * The anchored reference frame (#31) in the navigation model and the URL: it
 * follows the focus, the overview and reset() release it, and a link carries it.
 */
import { afterEach, describe, expect, it } from "vitest"

import { J2000_JD } from "@/sim"

import { OVERVIEW, frameForView, isFrameAnchored, viewMode } from "./navigation"
import { useSimStore } from "./sim"
import { simSearchSchema } from "./simSearch"
import { searchFromState, viewFromSearch } from "./urlSync"

const store = () => useSimStore.getState()
afterEach(() => useSimStore.setState(useSimStore.getInitialState(), true))

const arrive = () => {
	const { transition, settle } = store()
	if (transition !== null) settle(transition.id, 0)
}

describe("the reference frame in the navigation model", () => {
	it("is Sun-centred by default and while navigating normally", () => {
		expect(store().frameId).toBe("sun")
		store().setFocus("mars")
		expect(store().frameId).toBe("sun")
		expect(isFrameAnchored(store())).toBe(false)
	})

	it("anchors to a body and centres the view on it", () => {
		store().anchorFrame("earth", {
			shot: { elevationDeg: 89.9 },
			fit: { km: 4e8, around: "sun" },
		})
		expect(store().frameId).toBe("earth")
		expect(store().view).toEqual({ kind: "body", id: "earth" })
		expect(store().transition).toMatchObject({
			fit: { km: 4e8, around: "sun" },
			shot: { elevationDeg: 89.9 },
		})
		arrive()
		expect(viewMode(store())).toBe("focused")
		expect(isFrameAnchored(store())).toBe(true)
	})

	it("follows the focus: centring another body holds that one still", () => {
		store().anchorFrame("earth")
		arrive()
		store().setFocus("mars")
		expect(store().frameId).toBe("mars")
		store().goTo({ kind: "point", anchorId: "jupiter", offsetKm: [1e6, 0, 0] })
		expect(store().frameId).toBe("jupiter")
	})

	it("keeps a free centre near the body it anchors to", () => {
		const point = {
			kind: "point" as const,
			anchorId: "earth",
			offsetKm: [2e6, 0, 0] as const,
		}
		store().jumpTo(point)
		arrive()
		store().anchorFrame("earth")
		expect(store().view).toEqual(point)
		expect(store().frameId).toBe("earth")
	})

	it("is released by the overview, reset(), releaseFrame() and anchoring the Sun", () => {
		store().anchorFrame("earth")
		store().overview()
		expect(store().frameId).toBe("sun")

		store().anchorFrame("earth")
		store().select("mars")
		store().reset()
		expect(store().frameId).toBe("sun")
		expect(store().selectedId).toBeNull()

		store().anchorFrame("earth")
		store().select("mars")
		store().releaseFrame()
		expect(store().frameId).toBe("sun")
		expect(store().view).toEqual(OVERVIEW)
		// the lesson's subject stays selected
		expect(store().selectedId).toBe("mars")

		store().anchorFrame("earth")
		store().anchorFrame("sun")
		expect(store().frameId).toBe("sun")
		expect(store().view).toEqual(OVERVIEW)
	})

	it("ignores unknown bodies and broken regions", () => {
		store().anchorFrame("vulcan")
		expect(store().frameId).toBe("sun")
		expect(store().transition).toBeNull()
		store().anchorFrame("earth", { fit: { km: -1, around: "sun" } })
		expect(store().transition?.fit).toBeNull()
		store().anchorFrame("earth", { fit: { km: 1e6, around: "vulcan" } })
		expect(store().transition?.fit).toBeNull()
	})

	it("keeps a fit region through a skip", () => {
		store().anchorFrame("earth", { fit: { km: 1e6, around: "earth" } })
		store().skip()
		expect(store().transition).toMatchObject({
			durationMs: 0,
			fit: { km: 1e6, around: "earth" },
		})
	})

	it("keeps the frame on a pan settled near its body", () => {
		store().anchorFrame("earth")
		arrive()
		store().settleAt({
			kind: "point",
			anchorId: "earth",
			offsetKm: [5e7, 0, 0],
		})
		expect(store().frameId).toBe("earth")
	})

	it("frameForView: the Sun-centred frame stays, an anchored one follows", () => {
		expect(frameForView("sun", { kind: "body", id: "mars" })).toBe("sun")
		expect(frameForView("earth", { kind: "body", id: "mars" })).toBe("mars")
		expect(frameForView("earth", OVERVIEW)).toBe("sun")
	})
})

describe("the reference frame in the URL", () => {
	const base = {
		view: { kind: "body" as const, id: "earth" },
		selectedId: "mars",
		shot: null,
		timeWarp: 2629800,
		paused: false,
		simTimeJD: J2000_JD,
		showOrbits: true,
		showLabels: true,
		showMoons: true,
		showMarkers: true,
	}

	it("writes frame= while a body is held still, nothing when Sun-centred", () => {
		expect(searchFromState({ ...base, frameId: "earth" }, {}).frame).toBe(
			"earth",
		)
		expect(searchFromState({ ...base, frameId: "sun" }, {}).frame).toBe(
			undefined,
		)
	})

	it("reads it back, following the focus, and ignores unknown or Sun frames", () => {
		const read = (search: Record<string, unknown>) =>
			viewFromSearch(simSearchSchema.parse(search)).frameId
		expect(read({ focus: "earth", frame: "earth" })).toBe("earth")
		// the frame follows the focus
		expect(read({ focus: "mars", frame: "earth" })).toBe("mars")
		// without a focus, the frame's body is the centre
		expect(read({ frame: "earth" })).toBe("earth")
		expect(read({ focus: "earth", frame: "vulcan" })).toBeNull()
		expect(read({ focus: "earth", frame: "sun" })).toBeNull()
		expect(read({ focus: "earth" })).toBeNull()
	})
})
