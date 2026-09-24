/**
 * The simulation store (docs/ARCHITECTURE.md, "Store").
 *
 * React UI subscribes through selectors (`useSimStore((s) => s.paused)`); code
 * inside `useFrame` reads `useSimStore.getState()` so no frame ever causes a
 * re-render. Per-frame time advancing lives in `scene/SimClock.tsx`, which writes
 * back through `setState`/`advanceTime` at a throttled rate.
 */
import { create } from "zustand"

import { bodyById, type Body } from "@/data"
import { SECONDS_PER_DAY, dateToJD } from "@/sim"

/** A camera fly-to between two focus bodies; the camera phase blends the origin along it. */
export interface FlyTo {
	fromId: string
	toId: string
	/** `performance.now()` when the fly started. */
	startedAt: number
	durationMs: number
}

export interface SimState {
	/** Simulation time as a Julian Date. */
	simTimeJD: number
	/** Simulated seconds per real second. */
	timeWarp: number
	paused: boolean
	/** Id of the body at the render origin (always a known body). */
	focusId: string
	hoverId: string | null
	fly: FlyTo | null
	showOrbits: boolean
	showLabels: boolean
	showMoons: boolean

	/** Focus a body by id; unknown ids are ignored, a changed focus starts a fly-to. */
	setFocus: (id: string) => void
	endFly: () => void
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

export const DEFAULT_FOCUS_ID = "sun"
export const FLY_DURATION_MS = 1500

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
	simTimeJD: dateToJD(new Date()),
	timeWarp: 1,
	paused: false,
	focusId: DEFAULT_FOCUS_ID,
	hoverId: null,
	fly: null,
	showOrbits: true,
	showLabels: true,
	showMoons: true,

	setFocus: (id) => {
		if (!bodyById.has(id)) return
		const { focusId } = get()
		if (id === focusId) return
		set({
			focusId: id,
			fly: {
				fromId: focusId,
				toId: id,
				startedAt: performance.now(),
				durationMs: FLY_DURATION_MS,
			},
		})
	},
	endFly: () => {
		if (get().fly !== null) set({ fly: null })
	},
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
