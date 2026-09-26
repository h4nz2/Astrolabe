/**
 * The quiet interface (#42; docs/ARCHITECTURE.md, "HUD layout"): the state of
 * the solar system's HUD itself, not of the scene.
 *
 * - `panel`: the dock's own panels (Layers, Scale, the spacecraft list). The
 *   tools with a store of their own (light, birthday, sky tonight, hunt) keep
 *   their `open` flag there; `features/solarSystem/dock/exclusive.ts` keeps
 *   every docked panel, of either kind, to one at a time.
 * - `cardExpanded`: the body card shows its full facts. It starts small (name
 *   and one sentence) and keeps the viewer's choice while the page is open.
 * - `cameraMoving`: the camera is being dragged, zoomed or flown right now;
 *   the secondary controls dim meanwhile (`camera/motion.ts` writes it).
 *
 * Nothing here is in the URL: a link names a view, not how the controls sit.
 */
import { create } from "zustand"

/** The dock's own panels; the other tools have their own stores. */
export type HudPanel = "layers" | "scale" | "spacecraft"

export interface HudState {
	panel: HudPanel | null
	cardExpanded: boolean
	cameraMoving: boolean
	setPanel: (panel: HudPanel | null) => void
	/** Opens `panel`, or closes it when it is the one open. */
	togglePanel: (panel: HudPanel) => void
	setCardExpanded: (expanded: boolean) => void
	setCameraMoving: (moving: boolean) => void
}

export const useHudStore = create<HudState>()((set, get) => ({
	panel: null,
	cardExpanded: false,
	cameraMoving: false,
	setPanel: (panel) => set({ panel }),
	togglePanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
	setCardExpanded: (cardExpanded) => set({ cardExpanded }),
	setCameraMoving: (cameraMoving) => {
		if (get().cameraMoving !== cameraMoving) set({ cameraMoving })
	},
}))

export default useHudStore
