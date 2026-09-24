import { afterEach, describe, expect, it } from "vitest"

import { J2000_JD, dateToJD } from "@/sim"

import {
	DEFAULT_FOCUS_ID,
	FLY_DURATION_MS,
	WARP_PRESETS,
	isBodyShown,
	useSimStore,
} from "./sim"

const reset = () => useSimStore.setState(useSimStore.getInitialState(), true)

afterEach(reset)

describe("sim store", () => {
	it("starts at the wall clock, 1x, playing, focused on the Sun", () => {
		const { simTimeJD, timeWarp, paused, focusId, hoverId, fly } =
			useSimStore.getInitialState()
		expect(Math.abs(simTimeJD - dateToJD(new Date()))).toBeLessThan(1 / 24)
		expect(timeWarp).toBe(1)
		expect(paused).toBe(false)
		expect(focusId).toBe(DEFAULT_FOCUS_ID)
		expect(hoverId).toBeNull()
		expect(fly).toBeNull()
		expect(useSimStore.getState().showOrbits).toBe(true)
		expect(useSimStore.getState().showLabels).toBe(true)
		expect(useSimStore.getState().showMoons).toBe(true)
	})

	it("advances time by deltaSeconds * timeWarp, in days", () => {
		const { setSimTime, setTimeWarp, advanceTime } = useSimStore.getState()
		setSimTime(J2000_JD)
		advanceTime(86400)
		expect(useSimStore.getState().simTimeJD).toBeCloseTo(J2000_JD + 1, 12)

		setTimeWarp(86400)
		advanceTime(0.5)
		expect(useSimStore.getState().simTimeJD).toBeCloseTo(J2000_JD + 1.5, 12)

		setTimeWarp(31557600)
		advanceTime(1)
		expect(useSimStore.getState().simTimeJD).toBeCloseTo(
			J2000_JD + 1.5 + 365.25,
			9,
		)
	})

	it("does not advance while paused", () => {
		const { setSimTime, setPaused, togglePause, advanceTime } =
			useSimStore.getState()
		setSimTime(J2000_JD)
		setPaused(true)
		advanceTime(3600)
		expect(useSimStore.getState().simTimeJD).toBe(J2000_JD)

		togglePause()
		expect(useSimStore.getState().paused).toBe(false)
		advanceTime(3600)
		expect(useSimStore.getState().simTimeJD).toBeCloseTo(J2000_JD + 1 / 24, 12)

		togglePause()
		expect(useSimStore.getState().paused).toBe(true)
	})

	it("ignores unknown focus ids", () => {
		useSimStore.getState().setFocus("planet-x")
		expect(useSimStore.getState().focusId).toBe("sun")
		expect(useSimStore.getState().fly).toBeNull()
	})

	it("starts a fly-to when the focus changes and clears it with endFly", () => {
		const before = performance.now()
		useSimStore.getState().setFocus("io")
		const { focusId, fly } = useSimStore.getState()
		expect(focusId).toBe("io")
		expect(fly).not.toBeNull()
		expect(fly!.fromId).toBe("sun")
		expect(fly!.toId).toBe("io")
		expect(fly!.durationMs).toBe(FLY_DURATION_MS)
		expect(fly!.startedAt).toBeGreaterThanOrEqual(before)
		expect(fly!.startedAt).toBeLessThanOrEqual(performance.now())

		// a second change flies from the interrupted target
		useSimStore.getState().setFocus("earth")
		expect(useSimStore.getState().fly!.fromId).toBe("io")
		expect(useSimStore.getState().fly!.toId).toBe("earth")

		useSimStore.getState().endFly()
		expect(useSimStore.getState().fly).toBeNull()
		expect(useSimStore.getState().focusId).toBe("earth")
	})

	it("does not restart a fly for the current focus", () => {
		useSimStore.getState().setFocus("mars")
		useSimStore.getState().endFly()
		useSimStore.getState().setFocus("mars")
		expect(useSimStore.getState().fly).toBeNull()
	})

	it("sets the warp and ignores non-finite values", () => {
		const { setTimeWarp } = useSimStore.getState()
		setTimeWarp(3600)
		expect(useSimStore.getState().timeWarp).toBe(3600)
		setTimeWarp(Number.NaN)
		setTimeWarp(Number.POSITIVE_INFINITY)
		expect(useSimStore.getState().timeWarp).toBe(3600)
		for (const { value } of WARP_PRESETS) {
			setTimeWarp(value)
			expect(useSimStore.getState().timeWarp).toBe(value)
		}
	})

	it("setSimTime ignores non-finite values", () => {
		const { setSimTime } = useSimStore.getState()
		setSimTime(J2000_JD)
		setSimTime(Number.NaN)
		expect(useSimStore.getState().simTimeJD).toBe(J2000_JD)
	})

	it("setNow jumps to the wall clock and is monotonic", () => {
		const { setSimTime, setNow } = useSimStore.getState()
		setSimTime(J2000_JD)
		const before = dateToJD(new Date())
		setNow()
		const first = useSimStore.getState().simTimeJD
		expect(first).toBeGreaterThanOrEqual(before)
		expect(first).toBeLessThanOrEqual(dateToJD(new Date()))
		setNow()
		expect(useSimStore.getState().simTimeJD).toBeGreaterThanOrEqual(first)
	})

	it("tracks hover and the scene toggles", () => {
		const state = useSimStore.getState()
		state.setHover("europa")
		expect(useSimStore.getState().hoverId).toBe("europa")
		state.setHover(null)
		expect(useSimStore.getState().hoverId).toBeNull()
		state.setShowOrbits(false)
		state.setShowLabels(false)
		state.setShowMoons(false)
		expect(useSimStore.getState().showOrbits).toBe(false)
		expect(useSimStore.getState().showLabels).toBe(false)
		expect(useSimStore.getState().showMoons).toBe(false)
	})

	it("keeps the focus visible while the moons are hidden", () => {
		const io = { id: "io", kind: "moon" } as const
		const europa = { id: "europa", kind: "moon" } as const
		const jupiter = { id: "jupiter", kind: "planet" } as const
		const shown = { showMoons: true, focusId: "sun" }
		const hidden = { showMoons: false, focusId: "io" }
		expect(isBodyShown(io, shown)).toBe(true)
		expect(isBodyShown(europa, shown)).toBe(true)
		expect(isBodyShown(io, hidden)).toBe(true)
		expect(isBodyShown(europa, hidden)).toBe(false)
		expect(isBodyShown(jupiter, hidden)).toBe(true)
		// through the store: focusing Io and hiding the moons leaves Io rendered
		useSimStore.getState().setFocus("io")
		useSimStore.getState().setShowMoons(false)
		expect(isBodyShown(io, useSimStore.getState())).toBe(true)
		expect(isBodyShown(europa, useSimStore.getState())).toBe(false)
	})

	it("offers the seven warp presets from the architecture", () => {
		expect(WARP_PRESETS.map((preset) => preset.value)).toEqual([
			1, 60, 3600, 86400, 604800, 2629800, 31557600,
		])
		expect(WARP_PRESETS.map((preset) => preset.label)).toEqual([
			"1x",
			"1 min/s",
			"1 h/s",
			"1 day/s",
			"1 week/s",
			"1 month/s",
			"1 year/s",
		])
	})
})
