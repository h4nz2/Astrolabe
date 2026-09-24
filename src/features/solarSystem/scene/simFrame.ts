/**
 * The mutable per-frame state shared by everything below the Canvas
 * (docs/ARCHITECTURE.md, "Runtime contract").
 *
 * One SimFrame is created per Canvas, mutated in place by scene/SimClock.tsx
 * every frame and read by every other per-frame consumer through
 * `useSimFrame()`. It never changes identity, so it never causes a re-render.
 * All positions are doubles in km; `renderPosition()` subtracts the floating
 * origin in doubles and only then converts to float32-safe scene units.
 */
import { createContext, useContext } from "react"
import type { Vector3 } from "three"

import type { Body } from "@/data"
import { J2000_JD, buildIndex, computePositions, toUnits } from "@/sim"

export interface SimFrame {
	/** From "@/data", topological order (every parent before its children). */
	readonly bodies: readonly Body[]
	/** body id -> index into `bodies` (and `positionsKm`, times 3). */
	readonly index: ReadonlyMap<string, number>
	/** 3 doubles per body: world positions in km, scene frame axes, written every frame. */
	readonly positionsKm: Float64Array
	/** [x, y, z] render origin in world km: the camera's pivot, written by the camera director. */
	readonly originKm: Float64Array
	/** Simulation time (Julian Date) of the last update. */
	jd: number
	/** `toUnits(positionsKm[i] - originKm)` written into `out`. */
	renderPosition(i: number, out: Vector3): Vector3
	/** Same by id; throws for an unknown id. */
	renderPositionOf(id: string, out: Vector3): Vector3
}

/**
 * Builds the frame for `bodies` with positions already computed at `jd`, so
 * consumers that read it before the clock's first tick see real values.
 */
export function createSimFrame(
	bodies: readonly Body[],
	jd: number = J2000_JD,
): SimFrame {
	const index = buildIndex(bodies)
	const positionsKm = computePositions(bodies, jd, undefined, index)
	const originKm = new Float64Array(3)

	const frame: SimFrame = {
		bodies,
		index,
		positionsKm,
		originKm,
		jd,
		renderPosition(i, out) {
			const o = i * 3
			out.x = toUnits(positionsKm[o] - originKm[0])
			out.y = toUnits(positionsKm[o + 1] - originKm[1])
			out.z = toUnits(positionsKm[o + 2] - originKm[2])
			return out
		},
		renderPositionOf(id, out) {
			const i = index.get(id)
			if (i === undefined) throw new Error(`SimFrame: unknown body "${id}"`)
			return frame.renderPosition(i, out)
		},
	}
	return frame
}

/**
 * One clock tick: world positions at `jd` (SimClock's call), and the render
 * origin on body `originIndex` when one is given. In the app the origin is
 * the camera's pivot, which the camera director writes after this.
 */
export function updateSimFrame(
	frame: SimFrame,
	jd: number,
	originIndex?: number,
): void {
	computePositions(frame.bodies, jd, frame.positionsKm, frame.index)
	frame.jd = jd
	if (originIndex === undefined) return
	const o = originIndex * 3
	frame.originKm[0] = frame.positionsKm[o]
	frame.originKm[1] = frame.positionsKm[o + 1]
	frame.originKm[2] = frame.positionsKm[o + 2]
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
