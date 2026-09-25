/**
 * Light travel (#27): the light pulse and the light panel.
 *
 * A pulse is only its source and the simulation time it was sent at; where its
 * front is follows from the clock (src/sim/light.ts), so it pauses, speeds up
 * and runs backwards with everything else. Sending one sets the clock to real
 * time, forwards: watching light take its real 8 minutes is the lesson, and a
 * faster speed stays one deliberate click away in the time controls.
 *
 * Not persisted and not in the URL. Per-frame code reads it with
 * `useLightStore.getState()`; the HUD subscribes through selectors.
 */
import { create } from "zustand"

import { useSimStore } from "./sim"

export interface LightPulse {
	/** The body the light was sent from. */
	readonly emitterId: string
	/** Simulation time (JD) it was sent at. */
	readonly emitJD: number
}

export type LightTab = "pulse" | "delay" | "beyond"

export interface LightState {
	/** The pulse on its way, or null. */
	pulse: LightPulse | null
	/** Whether the light panel is open (its button stays in the HUD either way). */
	open: boolean
	tab: LightTab
	/** The body the next pulse is sent from. */
	emitterId: string
	/** The body the signal delay is shown for (from Earth). */
	delayTargetId: string
	/** Sends a pulse from `emitterId` now (simulation time) and runs the clock forwards in real time. */
	send: (emitterId?: string) => void
	/** Removes the pulse. */
	clear: () => void
	setOpen: (open: boolean) => void
	setTab: (tab: LightTab) => void
	setEmitter: (id: string) => void
	setDelayTarget: (id: string) => void
}

export const DEFAULT_EMITTER_ID = "sun"
export const DEFAULT_DELAY_TARGET_ID = "mars"
/** Where signals are sent from: us. */
export const HOME_ID = "earth"

export const useLightStore = create<LightState>()((set, get) => ({
	pulse: null,
	open: false,
	tab: "pulse",
	emitterId: DEFAULT_EMITTER_ID,
	delayTargetId: DEFAULT_DELAY_TARGET_ID,
	send: (emitterId = get().emitterId) => {
		const sim = useSimStore.getState()
		sim.setTimeWarp(1)
		sim.setPaused(false)
		set({
			emitterId,
			pulse: { emitterId, emitJD: useSimStore.getState().simTimeJD },
		})
	},
	clear: () => set({ pulse: null }),
	setOpen: (open) => set({ open }),
	setTab: (tab) => set({ tab }),
	setEmitter: (emitterId) => set({ emitterId }),
	setDelayTarget: (delayTargetId) => set({ delayTargetId }),
}))
