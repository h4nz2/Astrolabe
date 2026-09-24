/**
 * The active scale (docs/ARCHITECTURE.md, "Scale"): which of the engine's
 * named lies (src/sim/scale.ts) the scene is drawn with. The app opens in the
 * default preset, "Everything visible"; true scale is one `setPreset` away.
 *
 * `scene/ScaleSync.tsx` pushes every change into the Canvas's SimFrame, which
 * derives all display positions and radii from it. React UI (the #21 preset
 * picker) subscribes through selectors; per-frame code reads the SimFrame.
 * An animated preset change (#21) calls `setScale(interpolateScale(...))`
 * once per frame; `presetId` becomes null mid-way and the target id again
 * when the last step lands exactly on the preset.
 */
import { create } from "zustand"

import {
	DEFAULT_SCALE_PRESET,
	SCALE_PRESETS,
	isScalePresetId,
	isValidScale,
	presetOf,
	type ScaleFactor,
	type ScalePresetId,
	type ScaleSettings,
} from "@/sim"

export interface ScaleState {
	/** The settings every display position and radius derives from. */
	scale: ScaleSettings
	/** The preset `scale` equals, or null for a custom mix or a transition in progress. */
	presetId: ScalePresetId | null

	/** Switches to a named preset; unknown ids are ignored. */
	setPreset: (id: ScalePresetId) => void
	/** Replaces the whole scale; invalid settings (see `isValidScale`) are ignored. */
	setScale: (scale: ScaleSettings) => void
	/** Replaces one factor and keeps the other two; an invalid result is ignored. */
	setFactor: <K extends ScaleFactor>(factor: K, value: ScaleSettings[K]) => void
}

export const DEFAULT_SCALE: ScaleSettings = SCALE_PRESETS[DEFAULT_SCALE_PRESET]

export const useScaleStore = create<ScaleState>()((set, get) => ({
	scale: DEFAULT_SCALE,
	presetId: DEFAULT_SCALE_PRESET,

	setPreset: (id) => {
		if (!isScalePresetId(id)) return
		if (get().presetId === id) return
		set({ scale: SCALE_PRESETS[id], presetId: id })
	},
	setScale: (scale) => {
		if (!isValidScale(scale)) return
		const presetId = presetOf(scale)
		// a preset always travels as its frozen object, so identity checks work downstream
		set({
			scale: presetId === null ? scale : SCALE_PRESETS[presetId],
			presetId,
		})
	},
	setFactor: (factor, value) => {
		get().setScale({ ...get().scale, [factor]: value })
	},
}))

export default useScaleStore
