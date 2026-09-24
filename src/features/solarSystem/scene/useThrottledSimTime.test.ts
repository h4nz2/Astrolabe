import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { J2000_JD } from "@/sim"
import { useSimStore } from "@/store/sim"

import {
	SIM_TIME_UI_INTERVAL_MS,
	createThrottledSimTimeSource,
} from "./useThrottledSimTime"

describe("createThrottledSimTimeSource", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		useSimStore.setState({ simTimeJD: J2000_JD, paused: true })
	})
	afterEach(() => {
		vi.useRealTimers()
		useSimStore.setState(useSimStore.getInitialState(), true)
	})

	it("publishes the first change at once and coalesces the rest", () => {
		const source = createThrottledSimTimeSource(SIM_TIME_UI_INTERVAL_MS)
		const onChange = vi.fn()
		const unsubscribe = source.subscribe(onChange)
		expect(source.getSnapshot()).toBe(J2000_JD)

		useSimStore.getState().setSimTime(J2000_JD + 1)
		expect(onChange).toHaveBeenCalledTimes(1)
		expect(source.getSnapshot()).toBe(J2000_JD + 1)

		// a burst of frames within the interval: one trailing update only
		for (let i = 2; i <= 30; i++) {
			useSimStore.getState().setSimTime(J2000_JD + i)
			vi.advanceTimersByTime(1)
		}
		expect(onChange).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(SIM_TIME_UI_INTERVAL_MS)
		expect(onChange).toHaveBeenCalledTimes(2)
		expect(source.getSnapshot()).toBe(J2000_JD + 30)
		unsubscribe()
	})

	it("ignores store changes that leave the time alone", () => {
		const source = createThrottledSimTimeSource(SIM_TIME_UI_INTERVAL_MS)
		const onChange = vi.fn()
		const unsubscribe = source.subscribe(onChange)
		useSimStore.getState().setShowOrbits(false)
		useSimStore.getState().setTimeWarp(60)
		vi.advanceTimersByTime(SIM_TIME_UI_INTERVAL_MS * 2)
		expect(onChange).not.toHaveBeenCalled()
		unsubscribe()
	})

	it("stops listening and drops pending timers after the last unsubscribe", () => {
		const source = createThrottledSimTimeSource(SIM_TIME_UI_INTERVAL_MS)
		const onChange = vi.fn()
		const unsubscribe = source.subscribe(onChange)
		useSimStore.getState().setSimTime(J2000_JD + 1)
		useSimStore.getState().setSimTime(J2000_JD + 2)
		expect(onChange).toHaveBeenCalledTimes(1)
		unsubscribe()
		vi.advanceTimersByTime(SIM_TIME_UI_INTERVAL_MS * 2)
		useSimStore.getState().setSimTime(J2000_JD + 3)
		vi.advanceTimersByTime(SIM_TIME_UI_INTERVAL_MS * 2)
		expect(onChange).toHaveBeenCalledTimes(1)
		// a fresh subscription catches up without a notification
		source.subscribe(onChange)
		expect(source.getSnapshot()).toBe(J2000_JD + 3)
		expect(onChange).toHaveBeenCalledTimes(1)
	})
})
