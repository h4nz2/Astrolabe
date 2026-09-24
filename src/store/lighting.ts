/**
 * How the scene is lit (docs/ARCHITECTURE.md, "Lighting"; issue #22).
 * Honest by default: the Sun lights each body from where it really is, with
 * night sides and eclipse shadows. `alwaysLit` is the teacher's convenience:
 * every body lit from the viewer, whole face visible, no shadows.
 *
 * Per-frame code reads it with `useLightingStore.getState()`; the HUD
 * subscribes through selectors.
 */
import { create } from "zustand"

export interface LightingState {
	alwaysLit: boolean
	setAlwaysLit: (alwaysLit: boolean) => void
}

export const useLightingStore = create<LightingState>()((set) => ({
	alwaysLit: false,
	setAlwaysLit: (alwaysLit) => set({ alwaysLit }),
}))
