/**
 * Where the trails of an anchored reference frame start (#31; see
 * features/solarSystem/frame/trails.ts). By default a trail shows the last
 * two years at once; "Restart the trails" makes them grow from the current
 * moment, so a class can watch a loop draw itself. Leaving the anchored frame
 * forgets the restart.
 *
 * Per-frame code reads it with `useTrailStore.getState()`; the HUD subscribes
 * through selectors.
 */
import { create } from "zustand"

export interface TrailState {
	/** Julian Date the trails grow from, or null for the full two years. */
	sinceJD: number | null
	/** Restarts every trail at `jd` (non-finite values are ignored). */
	restartTrails: (jd: number) => void
	/** Back to the full two years. */
	clearRestart: () => void
}

export const useTrailStore = create<TrailState>()((set, get) => ({
	sinceJD: null,
	restartTrails: (jd) => {
		if (Number.isFinite(jd)) set({ sinceJD: jd })
	},
	clearRestart: () => {
		if (get().sinceJD !== null) set({ sinceJD: null })
	},
}))
