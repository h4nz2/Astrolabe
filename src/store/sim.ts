/**
 * The simulation store (docs/ARCHITECTURE.md, "Store").
 *
 * React UI subscribes through selectors (`useSimStore((s) => s.paused)`); code
 * inside `useFrame` reads `useSimStore.getState()` so no frame ever causes a
 * re-render. Per-frame time advancing lives in `scene/SimClock.tsx`, which writes
 * back through `setState`/`advanceTime` at a throttled rate.
 *
 * Selection and the camera's view (`selectedId`, `focusId`, `setFocus`,
 * `goTo`, ...) are the navigation slice composed in from `./navigation`.
 */
import { create } from "zustand"

import type { Body } from "@/data"
import { SECONDS_PER_DAY, dateToJD } from "@/sim"

import { createNavigationSlice, type NavigationSlice } from "./navigation"

export interface SimState extends NavigationSlice {
	/** Simulation time as a Julian Date. */
	simTimeJD: number
	/** Simulated seconds per real second. */
	timeWarp: number
	paused: boolean
	hoverId: string | null
	showOrbits: boolean
	showLabels: boolean
	showMoons: boolean

	/** Non-finite values are ignored. */
	setTimeWarp: (warp: number) => void
	togglePause: () => void
	setPaused: (paused: boolean) => void
	/** Non-finite values are ignored. */
	setSimTime: (jd: number) => void
	/** Adds `deltaSeconds * timeWarp` of simulated time; a no-op while paused. */
	advanceTime: (deltaSeconds: number) => void
	setHover: (id: string | null) => void
	setShowOrbits: (show: boolean) => void
	setShowLabels: (show: boolean) => void
	setShowMoons: (show: boolean) => void
	/** Jumps the simulation to the wall clock. */
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

export const useSimStore = create<SimState>()((set, get) => ({
	...createNavigationSlice(set, get),
	simTimeJD: dateToJD(new Date()),
	timeWarp: 1,
	paused: false,
	hoverId: null,
	showOrbits: true,
	showLabels: true,
	showMoons: true,

	setTimeWarp: (warp) => {
		if (Number.isFinite(warp)) set({ timeWarp: warp })
	},
	togglePause: () => set((state) => ({ paused: !state.paused })),
	setPaused: (paused) => set({ paused }),
	setSimTime: (jd) => {
		if (Number.isFinite(jd)) set({ simTimeJD: jd })
	},
	advanceTime: (deltaSeconds) => {
		const { paused, simTimeJD, timeWarp } = get()
		if (paused) return
		set({ simTimeJD: simTimeJD + (deltaSeconds * timeWarp) / SECONDS_PER_DAY })
	},
	setHover: (id) => {
		if (get().hoverId !== id) set({ hoverId: id })
	},
	setShowOrbits: (show) => set({ showOrbits: show }),
	setShowLabels: (show) => set({ showLabels: show }),
	setShowMoons: (show) => set({ showMoons: show }),
	setNow: () => set({ simTimeJD: dateToJD(new Date()) }),
}))

export default useSimStore
