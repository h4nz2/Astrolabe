/**
 * The named points of view (#31): what a teacher picks instead of assembling
 * a frame, a camera and a speed. Everything goes through the navigation model
 * (`anchorFrame`, `releaseFrame`) and the clock actions; nothing here touches
 * the camera or the clock directly.
 */
import { bodyById } from "@/data"
import { AU_KM } from "@/sim"
import { OVERVIEW_BODY_ID, type ViewRequest } from "@/store/navigation"
import { useSimStore, type SimState } from "@/store/sim"
import { useTrailStore } from "@/store/trails"

/** One day, one month of simulated time per real second (the #14 presets). */
export const DAY_PER_SECOND = 86400
export const MONTH_PER_SECOND = 2629800

export const FRAME_PRESET_IDS = ["sun", "planets", "moon"] as const
export type FramePresetId = (typeof FRAME_PRESET_IDS)[number]

interface FramePreset {
	/** The body held still (the Sun: the Sun-centred frame). */
	anchorId: string
	/** The body the lesson is about: selected, its trail drawn brighter. */
	selectId: string | null
	/** Camera on arrival. */
	request: ViewRequest
	/** Speed the clock is set to (forwards, playing), in simulated seconds per second. */
	warp: number | null
}

const moonOrbitKm = bodyById.get("moon")?.orbit?.semiMajorAxisKm ?? 384_400

export const FRAME_PRESETS: Readonly<Record<FramePresetId, FramePreset>> = {
	sun: { anchorId: OVERVIEW_BODY_ID, selectId: null, request: {}, warp: null },
	/**
	 * Earth held still, seen from high above the ecliptic, framing Mars's path
	 * around Earth out to 2.5 AU (all but its far side), at a month a second: Mars's retrograde loop
	 * draws itself in a few seconds, the Sun circles Earth once in twelve.
	 */
	planets: {
		anchorId: "earth",
		selectId: "mars",
		request: {
			shot: { azimuthDeg: 0, elevationDeg: 89.9 },
			fit: { km: 2.5 * AU_KM, around: OVERVIEW_BODY_ID },
		},
		warp: MONTH_PER_SECOND,
	},
	/**
	 * Earth held still with the Moon's orbit filling the view, at a day a
	 * second: one month of phases in half a minute, read in the HUD.
	 */
	moon: {
		anchorId: "earth",
		selectId: "moon",
		request: {
			shot: { azimuthDeg: 0, elevationDeg: 89.9 },
			fit: { km: 1.3 * moonOrbitKm, around: "earth" },
		},
		warp: DAY_PER_SECOND,
	},
}

type PresetStore = Pick<
	SimState,
	| "anchorFrame"
	| "releaseFrame"
	| "select"
	| "setTimeWarp"
	| "setPaused"
	| "simTimeJD"
>

/** Switches to a named point of view: the frame, the camera, the selection and the speed. */
export function applyFramePreset(
	id: FramePresetId,
	store: PresetStore = useSimStore.getState(),
): void {
	const preset = FRAME_PRESETS[id]
	useTrailStore.getState().clearRestart()
	if (preset.anchorId === OVERVIEW_BODY_ID) {
		store.releaseFrame()
		return
	}
	store.anchorFrame(preset.anchorId, preset.request)
	if (preset.selectId !== null) store.select(preset.selectId)
	if (preset.warp !== null) {
		store.setTimeWarp(preset.warp)
		store.setPaused(false)
	}
}

/** The preset the store is in right now, if any (the frame and the selection match). */
export function activeFramePreset(
	state: Pick<SimState, "frameId" | "selectedId">,
): FramePresetId | null {
	if (state.frameId === OVERVIEW_BODY_ID) return "sun"
	for (const id of FRAME_PRESET_IDS) {
		const preset = FRAME_PRESETS[id]
		if (
			preset.anchorId === state.frameId &&
			preset.selectId === state.selectedId
		) {
			return id
		}
	}
	return null
}

/**
 * The body the HUD reads the sky for, seen from the frame's anchor: the
 * selection when it is another body, else Mars from Earth (the lesson), else
 * Earth (from anywhere else), else the Sun.
 */
export function skyTarget(frameId: string, selectedId: string | null): string {
	if (
		selectedId !== null &&
		selectedId !== frameId &&
		bodyById.has(selectedId)
	) {
		return selectedId
	}
	if (frameId === "earth") return "mars"
	if (frameId !== "earth" && bodyById.has("earth")) return "earth"
	return OVERVIEW_BODY_ID
}
