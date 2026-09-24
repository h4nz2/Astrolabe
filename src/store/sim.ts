/**
 * The simulation store (docs/ARCHITECTURE.md, "Store").
 *
 * React UI subscribes through selectors (`useSimStore((s) => s.paused)`); code
 * inside `useFrame` reads `useSimStore.getState()` so no frame ever causes a
 * re-render.
 *
 * Time (issue #9): `clock` is the one time source, simulation time as a pure
 * function of real time (src/sim/clock.ts). The time actions below re-anchor it
 * at `performance.now()`; `scene/SimClock.tsx` samples it once per frame with
 * `tick()` into `simTimeJD`, which every consumer reads. Nothing else may write
 * `simTimeJD`, `timeWarp`, `paused` or `clock` directly (a bare `setState`
 * would bypass the clock); use the actions.
 *
 * Selection and the camera's view (`selectedId`, `focusId`, `setFocus`,
 * `goTo`, ...) are the navigation slice composed in from `./navigation`.
 */
import { create } from "zustand"

import type { Body } from "@/data"
import {
	MS_PER_DAY,
	createTimeline,
	dateToJD,
	glideDurationMs,
	glideTimeline,
	jumpTimeline,
	retimeTimeline,
	settleTimeline,
	skipFrameGap,
	timelineJD,
	type SimTimeline,
} from "@/sim"

import { createNavigationSlice, type NavigationSlice } from "./navigation"

export interface SimState extends NavigationSlice {
	/**
	 * Simulation time (Julian Date) of the current frame: the clock sampled by
	 * the last `tick()` or time action. React UI reads it via `useThrottledSimTime()`.
	 */
	simTimeJD: number
	/** Simulated seconds per real second while playing; negative runs backwards. Kept while paused. */
	timeWarp: number
	paused: boolean
	/**
	 * The clock: simulation time as a function of `performance.now()`, running
	 * at `paused ? 0 : timeWarp`. `clock.glide` is non-null while a `travelTo`
	 * glide is under way (cleared by the first tick after it lands), and
	 * `clock.anchorMs` is then its arrival time.
	 */
	clock: SimTimeline
	/** `performance.now()` of the last `tick()`; null before the first frame. */
	lastTickMs: number | null
	hoverId: string | null
	showOrbits: boolean
	showLabels: boolean
	showMoons: boolean
	/** Screen-sized dots for bodies too small to see (scene/Markers.tsx). */
	showMarkers: boolean

	/**
	 * Speed in simulated seconds per real second; negative reverses. Nothing
	 * moves at the moment of the change. Non-finite values are ignored.
	 */
	setTimeWarp: (warp: number) => void
	togglePause: () => void
	/** Freezes (or resumes) every body at once, exactly where it is. */
	setPaused: (paused: boolean) => void
	/** Instant jump to a Julian Date (deep links, tests). Non-finite values are ignored. */
	setSimTime: (jd: number) => void
	/**
	 * Time travel: glides the clock to `jd` over `durationMs` (default
	 * `glideDurationMs` of the distance) so every body sweeps along its path,
	 * then runs on at the current speed (or stays paused). Works while paused.
	 * Non-finite values are ignored.
	 */
	travelTo: (jd: number, durationMs?: number) => void
	/** The clock sample for the frame at `realMs` (`performance.now()`). SimClock's job; nobody else calls it. */
	tick: (realMs: number) => void
	setHover: (id: string | null) => void
	setShowOrbits: (show: boolean) => void
	setShowLabels: (show: boolean) => void
	setShowMoons: (show: boolean) => void
	setShowMarkers: (show: boolean) => void
	/** Travels (glides) to the wall clock, arriving on the present. */
	setNow: () => void
}

/**
 * Whether a body is rendered at all (meshes, orbit line, marker): moons only
 * while `showMoons` is on, except the focus, which stays visible so hiding the
 * moons never leaves the camera staring at nothing (docs/ARCHITECTURE.md, "Toggles").
 */
export const isBodyShown = (
	body: Pick<Body, "id" | "kind">,
	state: Pick<SimState, "showMoons" | "focusId">,
): boolean =>
	state.showMoons || body.kind !== "moon" || body.id === state.focusId

export const WARP_PRESETS: readonly { label: string; value: number }[] = [
	{ label: "1x", value: 1 },
	{ label: "1 min/s", value: 60 },
	{ label: "1 h/s", value: 3600 },
	{ label: "1 day/s", value: 86400 },
	{ label: "1 week/s", value: 604800 },
	{ label: "1 month/s", value: 2629800 },
	{ label: "1 year/s", value: 31557600 },
]

/** The store fields a changed clock sets: the clock and its sample at `realMs`. */
const clockAt = (clock: SimTimeline, realMs: number) => ({
	clock,
	simTimeJD: timelineJD(clock, realMs),
})

const initialJD = dateToJD(new Date())

export const useSimStore = create<SimState>()((set, get) => ({
	...createNavigationSlice(set, get),
	simTimeJD: initialJD,
	timeWarp: 1,
	paused: false,
	clock: createTimeline(initialJD, performance.now(), 1),
	lastTickMs: null,
	hoverId: null,
	showOrbits: true,
	showLabels: true,
	showMoons: true,
	showMarkers: true,

	setTimeWarp: (warp) => {
		if (!Number.isFinite(warp)) return
		const { clock, paused } = get()
		const now = performance.now()
		set({
			timeWarp: warp,
			...clockAt(retimeTimeline(clock, now, paused ? 0 : warp), now),
		})
	},
	togglePause: () => get().setPaused(!get().paused),
	setPaused: (paused) => {
		const { clock, timeWarp } = get()
		const now = performance.now()
		set({
			paused,
			...clockAt(retimeTimeline(clock, now, paused ? 0 : timeWarp), now),
		})
	},
	setSimTime: (jd) => {
		if (!Number.isFinite(jd)) return
		const now = performance.now()
		set(clockAt(jumpTimeline(get().clock, now, jd), now))
	},
	travelTo: (jd, durationMs) => {
		if (!Number.isFinite(jd)) return
		const now = performance.now()
		set(clockAt(glideTimeline(get().clock, now, jd, durationMs), now))
	},
	tick: (realMs) => {
		const { clock, lastTickMs } = get()
		const gapped =
			lastTickMs === null ? clock : skipFrameGap(clock, lastTickMs, realMs)
		set({
			...clockAt(settleTimeline(gapped, realMs), realMs),
			lastTickMs: realMs,
		})
	},
	setHover: (id) => {
		if (get().hoverId !== id) set({ hoverId: id })
	},
	setShowOrbits: (show) => set({ showOrbits: show }),
	setShowLabels: (show) => set({ showLabels: show }),
	setShowMoons: (show) => set({ showMoons: show }),
	setShowMarkers: (show) => set({ showMarkers: show }),
	setNow: () => {
		const { clock, travelTo } = get()
		const now = dateToJD(new Date())
		const durationMs = glideDurationMs(
			now - timelineJD(clock, performance.now()),
		)
		// aim at the present as it will be on arrival
		travelTo(now + durationMs / MS_PER_DAY, durationMs)
	},
}))

export default useSimStore
