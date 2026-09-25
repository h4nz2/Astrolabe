import { afterEach, describe, expect, it } from "vitest"

import { useSimStore } from "@/store/sim"
import { useTrailStore } from "@/store/trails"

import {
	DAY_PER_SECOND,
	MONTH_PER_SECOND,
	activeFramePreset,
	applyFramePreset,
	skyTarget,
} from "./presets"

const store = () => useSimStore.getState()
afterEach(() => {
	useSimStore.setState(useSimStore.getInitialState(), true)
	useTrailStore.setState(useTrailStore.getInitialState(), true)
})

describe("frame presets", () => {
	it("'Seen from Earth: the planets' holds Earth still, selects Mars and runs a month a second", () => {
		store().setPaused(true)
		applyFramePreset("planets")
		expect(store().frameId).toBe("earth")
		expect(store().view).toEqual({ kind: "body", id: "earth" })
		expect(store().selectedId).toBe("mars")
		expect(store().timeWarp).toBe(MONTH_PER_SECOND)
		expect(store().paused).toBe(false)
		expect(store().transition?.fit?.around).toBe("sun")
		expect(activeFramePreset(store())).toBe("planets")
	})

	it("'Seen from Earth: the Moon' frames the Moon's orbit at a day a second", () => {
		store().setTimeWarp(-31557600)
		applyFramePreset("moon")
		expect(store().frameId).toBe("earth")
		expect(store().selectedId).toBe("moon")
		expect(store().timeWarp).toBe(DAY_PER_SECOND)
		expect(store().transition?.fit?.around).toBe("earth")
		expect(activeFramePreset(store())).toBe("moon")
	})

	it("'Sun-centred' is the way back, keeping the speed", () => {
		applyFramePreset("planets")
		useTrailStore.getState().restartTrails(2460000)
		applyFramePreset("sun")
		expect(store().frameId).toBe("sun")
		expect(store().timeWarp).toBe(MONTH_PER_SECOND)
		expect(activeFramePreset(store())).toBe("sun")
		expect(useTrailStore.getState().sinceJD).toBeNull()
	})

	it("recognises no preset for another selection or anchor", () => {
		applyFramePreset("planets")
		store().select("venus")
		expect(activeFramePreset(store())).toBeNull()
	})
})

describe("skyTarget", () => {
	it("reads the selection, else Mars from Earth, else Earth", () => {
		expect(skyTarget("earth", "venus")).toBe("venus")
		expect(skyTarget("earth", null)).toBe("mars")
		expect(skyTarget("earth", "earth")).toBe("mars")
		expect(skyTarget("mars", null)).toBe("earth")
		expect(skyTarget("moon", null)).toBe("earth")
	})
})
