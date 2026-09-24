/**
 * How fast the bodies spin on screen (issue #13; src/sim/spin.ts,
 * docs/ARCHITECTURE.md, "Rotation"). Honest by default: `realistic` turns every
 * body exactly as the simulation clock says. The other named modes cap the spin
 * so a day stays watchable at any time warp, without touching orbital speed.
 *
 * Not persisted and not in the URL: every visit opens with the true spin.
 * Per-frame code reads it with `useSpinStore.getState()`; the HUD subscribes
 * through selectors.
 */
import { create } from "zustand"

import { DEFAULT_SPIN_MODE, type SpinMode } from "@/sim"

export interface SpinState {
	mode: SpinMode
	setMode: (mode: SpinMode) => void
}

export const useSpinStore = create<SpinState>()((set) => ({
	mode: DEFAULT_SPIN_MODE,
	setMode: (mode) => set({ mode }),
}))
