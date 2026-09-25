/**
 * The mutable per-frame state shared by everything below the Canvas
 * (docs/ARCHITECTURE.md, "Runtime contract").
 *
 * One SimFrame is created per Canvas, mutated in place by scene/SimClock.tsx
 * every frame and read by every other per-frame consumer through
 * `useSimFrame()`. It never changes identity, so it never causes a re-render.
 * All positions are doubles in km. `positionsKm` holds the true positions (the
 * physics); `displayKm` and `displayRadiiKm` hold what is drawn under the
 * active scale (src/sim/scale.ts) and are the only positions and sizes a
 * renderer may use. `renderPosition()` subtracts the floating origin in
 * doubles and only then converts to float32-safe scene units.
 */
import { createContext, useContext } from "react"
import type { Vector3 } from "three"

import type { Body } from "@/data"
import {
	J2000_JD,
	TRUE_SCALE,
	buildIndex,
	computeDisplayPositions,
	computeDisplayRadii,
	computePositions,
	rootIndexOf,
	toUnits,
	type ScaleSettings,
} from "@/sim"
import {
	applyReferenceFrame,
	topLevelIndices,
	type FrameBlend,
} from "@/sim/referenceFrame"

export interface SimFrame {
	/** From "@/data", topological order (every parent before its children). */
	readonly bodies: readonly Body[]
	/** body id -> index into `bodies` (and `positionsKm`, times 3). */
	readonly index: ReadonlyMap<string, number>
	/** 3 doubles per body: TRUE world positions in km, scene frame axes, written every frame. Physics only, never drawn. */
	readonly positionsKm: Float64Array
	/** 3 doubles per body: display positions (display km, scene axes) under the active scale, written every frame. What is drawn. */
	readonly displayKm: Float64Array
	/** Drawn radius per body (display km); rewritten on every scale change. */
	readonly displayRadiiKm: Float64Array
	/** [x, y, z] render origin in DISPLAY km: the camera's pivot, written by the camera director. */
	readonly originKm: Float64Array
	/** Simulation time (Julian Date) of the last update. */
	jd: number
	/**
	 * Spin time: the Julian Date every body's spin angle is evaluated at, written by
	 * scene/SpinClock.tsx. Equals `jd` in the realistic spin mode (src/sim/spin.ts).
	 */
	spinJD: number
	/** The active scale; change it with `setSimFrameScale`, never by assignment. */
	scale: ScaleSettings
	/** Incremented by every `setSimFrameScale`; per-frame consumers cache scale-derived geometry on it. */
	scaleVersion: number
	/**
	 * The anchored reference frames the display positions are drawn in (#31,
	 * src/sim/referenceFrame.ts): top-level anchor bodies and their weights,
	 * written by scene/ReferenceFrameSync.tsx before every tick. All weights
	 * 0 (the default) is the Sun-centred frame.
	 */
	readonly frameBlend: FrameBlend
	/** Top-level body (the root's child it belongs to) of every body; the root for the root. */
	readonly topIndex: Int32Array
	/** `toUnits(displayKm[i] - originKm)` written into `out`. */
	renderPosition(i: number, out: Vector3): Vector3
	/** Same by id; throws for an unknown id. */
	renderPositionOf(id: string, out: Vector3): Vector3
	/** Drawn radius of body `i` in scene units: `toUnits(displayRadiiKm[i])`. */
	renderRadius(i: number): number
}

/**
 * Builds the frame for `bodies` with positions already computed at `jd`, so
 * consumers that read it before the clock's first tick see real values.
 * `scale` defaults to true scale, the engine's baseline; the page passes the
 * active one from the scale store (src/store/scale.ts).
 */
export function createSimFrame(
	bodies: readonly Body[],
	jd: number = J2000_JD,
	scale: ScaleSettings = TRUE_SCALE,
): SimFrame {
	const index = buildIndex(bodies)
	const positionsKm = computePositions(bodies, jd, undefined, index)
	const displayRadiiKm = computeDisplayRadii(bodies, scale)
	const displayKm = computeDisplayPositions(
		bodies,
		positionsKm,
		displayRadiiKm,
		scale,
		index,
	)
	const originKm = new Float64Array(3)
	const topIndex = topLevelIndices(bodies, index)
	const root = rootIndexOf(bodies)

	const frame: SimFrame = {
		bodies,
		index,
		positionsKm,
		displayKm,
		displayRadiiKm,
		originKm,
		jd,
		spinJD: jd,
		scale,
		scaleVersion: 0,
		frameBlend: {
			anchors: new Int32Array(FRAME_BLEND_SLOTS).fill(root),
			weights: new Float64Array(FRAME_BLEND_SLOTS),
		},
		topIndex,
		renderPosition(i, out) {
			const o = i * 3
			out.x = toUnits(displayKm[o] - originKm[0])
			out.y = toUnits(displayKm[o + 1] - originKm[1])
			out.z = toUnits(displayKm[o + 2] - originKm[2])
			return out
		},
		renderPositionOf(id, out) {
			const i = index.get(id)
			if (i === undefined) throw new Error(`SimFrame: unknown body "${id}"`)
			return frame.renderPosition(i, out)
		},
		renderRadius(i) {
			return toUnits(displayRadiiKm[i])
		},
	}
	return frame
}

/** Anchored frames blended at once: the one being left and the one being entered. */
export const FRAME_BLEND_SLOTS = 2

// shared by every SimFrame (they are updated one at a time); grows to the largest body list
let frameScratch = new Float64Array(0)

/** Display positions from the current true positions, scale and reference frame. */
const refreshDisplay = (frame: SimFrame): void => {
	computeDisplayPositions(
		frame.bodies,
		frame.positionsKm,
		frame.displayRadiiKm,
		frame.scale,
		frame.index,
		frame.displayKm,
	)
	if (frameScratch.length < frame.bodies.length * 3) {
		frameScratch = new Float64Array(frame.bodies.length * 3)
	}
	applyReferenceFrame(
		frame.bodies,
		frame.positionsKm,
		frame.displayKm,
		frame.scale,
		frame.topIndex,
		frame.frameBlend,
		frameScratch,
	)
}

/**
 * One clock tick: true world positions at `jd` and their display positions
 * under the active scale (SimClock's call), and the render origin on body
 * `originIndex` when one is given. In the app the origin is the camera's
 * pivot, which the camera director writes right after this.
 */
export function updateSimFrame(
	frame: SimFrame,
	jd: number,
	originIndex?: number,
): void {
	computePositions(frame.bodies, jd, frame.positionsKm, frame.index)
	frame.jd = jd
	refreshDisplay(frame)
	if (originIndex === undefined) return
	const o = originIndex * 3
	frame.originKm[0] = frame.displayKm[o]
	frame.originKm[1] = frame.displayKm[o + 1]
	frame.originKm[2] = frame.displayKm[o + 2]
}

/**
 * Switches the frame to `scale`: display radii and positions are recomputed
 * at once and `scaleVersion` moves on, so every consumer re-derives its
 * geometry (orbit lines, rings, framing) from the same values. The render
 * origin follows at the camera director's next tick, before anything draws.
 * A no-op when `scale` is already active. scene/ScaleSync.tsx is the only
 * caller in the app.
 */
export function setSimFrameScale(frame: SimFrame, scale: ScaleSettings): void {
	if (frame.scale === scale) return
	frame.scale = scale
	frame.scaleVersion++
	computeDisplayRadii(frame.bodies, scale, frame.displayRadiiKm)
	refreshDisplay(frame)
}

export const SimFrameContext = createContext<SimFrame | null>(null)

/** The Canvas's SimFrame; throws outside a `SimFrameContext.Provider`. */
export const useSimFrame = (): SimFrame => {
	const frame = useContext(SimFrameContext)
	if (frame === null) {
		throw new Error("useSimFrame must be used below <SimFrameContext.Provider>")
	}
	return frame
}
