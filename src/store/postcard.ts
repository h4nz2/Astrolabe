/**
 * The postcard (issue #33): a picture of what is on screen, stamped and handed
 * to the visitor. This store only holds the snapshot taken at the click while
 * the postcard dialog is open; the picture itself is made on the device
 * (features/solarSystem/postcard) and never leaves it unless the visitor saves,
 * copies or shares it. Nothing here is persisted.
 */
import { create } from "zustand"

import type { ScalePresetId } from "@/sim"

/** A body or orbit name as it was on screen (labels are DOM, not in the WebGL picture). */
export interface ShotLabel {
	text: string
	/** Left edge and vertical middle, in CSS px from the canvas's top left. */
	x: number
	y: number
	/** CSS font shorthand parts, as computed. */
	fontStyle: string
	fontWeight: string
	fontSizePx: number
	fontFamily: string
	color: string
	opacity: number
}

/** The scene as drawn at the click: the WebGL picture and the names over it. */
export interface SceneShot {
	image: HTMLCanvasElement
	/** Image pixels per CSS pixel of the canvas. */
	ratio: number
	labels: readonly ShotLabel[]
}

/** One line of extra facts under the picture (the birthday ages, a comparison). */
export interface PostcardRow {
	id: string
	label: string
	value: string
	/** A dot in this colour before the label. */
	color?: string
}

/**
 * What a feature adds to the postcard of the current view (the birthday
 * result, #26; the comparison, #24). Every field is optional.
 */
export interface PostcardExtra {
	title?: string
	caption?: string
	/** Replaces the simulation date; null leaves the date out. */
	date?: string | null
	rows?: readonly PostcardRow[]
	note?: string
	/** With the ".png" extension. */
	fileName?: string
}

/** Everything the postcard is made from, frozen at the click. */
export interface PostcardSnapshot {
	shot: SceneShot
	/** The simulation time on screen. */
	jd: number
	/** The body the picture is of (the selection, else the focus), none for the overview or a free view. */
	subjectId: string | null
	scalePreset: ScalePresetId | null
	/** Leave the simulation date off the picture and out of the link (a birth date is entered). */
	hideDate: boolean
	/** A link that opens this view. */
	link: string
	extra: PostcardExtra | null
}

export interface PostcardState {
	snapshot: PostcardSnapshot | null
	show: (snapshot: PostcardSnapshot) => void
	close: () => void
}

export const usePostcardStore = create<PostcardState>()((set) => ({
	snapshot: null,
	show: (snapshot) => set({ snapshot }),
	close: () => set({ snapshot: null }),
}))
