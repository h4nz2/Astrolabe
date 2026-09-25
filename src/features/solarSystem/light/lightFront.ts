/**
 * The light front as drawn (#27): the circle where a light pulse's sphere cuts
 * the plane of the planets, mapped into display space every frame.
 *
 * The sphere is centred where its source was when it was sent (true km, fixed
 * in the Sun-centred frame) and has the TRUE radius c * t. Only the drawing
 * goes through the scale engine, with the same rule the bodies use
 * (docs/ARCHITECTURE.md, "Scale"): a point of the front is drawn at its anchor
 * body's drawn position plus `displayOffset` of its true offset from that body.
 *
 *  - Anchored on the Sun (the planets' own rule), the front passes through
 *    every planet as drawn exactly when the light reaches it, in every preset.
 *  - While the pulse is still inside the neighbourhood (Hill sphere) of the
 *    planet that sent it, or of the moon's planet, it is anchored on that
 *    planet with the moons' rule instead, so it crosses the drawn moons on
 *    time (the Moon 1.3 s after leaving Earth). It fades out as it reaches the
 *    edge of that neighbourhood, where the two rules disagree in every preset
 *    but true scale (a planet drawn 10x too big hides the first minute of the
 *    Sun-anchored front inside itself).
 *
 * At true scale both rules are the identity: the drawn front is the true circle.
 *
 * Pure apart from the typed arrays it fills; allocates nothing per frame.
 */
import type { Body } from "@/data"
import {
	childDistanceCurve,
	displayOffset,
	rootIndexOf,
	toUnits,
	type ScaleSettings,
} from "@/sim"
import { neighbourhoodRadiusKm, truePositionAt } from "@/sim/light"

/** Vertices of the drawn circle (a line loop). */
export const FRONT_VERTICES = 512

/** Beyond this radius (km, about 270 AU) the front is no longer drawn: it has left everything there is to see. */
export const MAX_FRONT_RADIUS_KM = 4e10

/** Fraction of the neighbourhood radius where the planet-anchored front starts fading out. */
export const LOCAL_FADE_START = 0.6

/** Where a pulse started and which body its early front is drawn around. */
export interface FrontSource {
	/** TRUE position (km, Sun-centred scene axes) of the source when the pulse was sent. */
	readonly origin: Float64Array
	/** Body index the early front is anchored on: the source's planet (itself, or a moon's planet), or the root. */
	readonly anchor: number
	/** True radius (km) of the anchor's neighbourhood; Infinity for the root. */
	readonly neighbourhoodKm: number
	readonly root: number
}

/** What the front needs of the SimFrame (scene/simFrame.ts). */
export interface FrontFrame {
	readonly bodies: readonly Body[]
	readonly index: ReadonlyMap<string, number>
	readonly positionsKm: Float64Array
	readonly displayKm: Float64Array
	readonly displayRadiiKm: Float64Array
	readonly originKm: Float64Array
	readonly scale: ScaleSettings
}

/** The source of a pulse sent from body `emitter` at `emitJD`. */
export function frontSource(
	bodies: readonly Body[],
	index: ReadonlyMap<string, number>,
	emitter: number,
	emitJD: number,
): FrontSource {
	const root = rootIndexOf(bodies)
	const origin = truePositionAt(
		bodies,
		index,
		emitter,
		emitJD,
		new Float64Array(3),
	)
	// the planet the source belongs to: itself, or the planet a moon orbits
	let anchor = emitter
	while (anchor !== root) {
		const parentId = bodies[anchor].parentId
		const parent = parentId === null ? undefined : index.get(parentId)
		if (parent === undefined || parent === root) break
		anchor = parent
	}
	const parentId = bodies[anchor].parentId
	const parent =
		parentId === null ? undefined : bodies[index.get(parentId) ?? -1]
	return {
		origin,
		anchor,
		neighbourhoodKm:
			anchor === root
				? Infinity
				: neighbourhoodRadiusKm(bodies[anchor], parent),
		root,
	}
}

/** How the front is drawn this frame. */
export interface FrontState {
	/** False when there is nothing to draw (not sent yet at this time, or gone beyond `MAX_FRONT_RADIUS_KM`). */
	visible: boolean
	/** 0..1, fading out the planet-anchored front at the edge of its neighbourhood. */
	opacity: number
	/** The body the front is anchored on this frame. */
	anchor: number
}

/** Which body the front is anchored on at `radiusKm`: the source's planet while inside its neighbourhood, else the root. */
export const frontAnchor = (source: FrontSource, radiusKm: number): number =>
	radiusKm < source.neighbourhoodKm ? source.anchor : source.root

/** Opacity of the front at `radiusKm`: 1, fading to 0 over the outer part of the source planet's neighbourhood. */
export function frontOpacity(source: FrontSource, radiusKm: number): number {
	if (source.anchor === source.root) return 1
	const x = radiusKm / source.neighbourhoodKm
	if (x >= 1 || x <= LOCAL_FADE_START) return 1
	const t = (x - LOCAL_FADE_START) / (1 - LOCAL_FADE_START)
	return 1 - t * t * (3 - 2 * t)
}

const offset = new Float64Array(3)

/**
 * Display position (display km) of the front's point at angle `theta` (radians,
 * in the plane of the source, measured from +X toward +Z) at `radiusKm`,
 * anchored on body `anchor`; written into `out[at..at + 2]`.
 */
export function frontPointDisplayKm(
	frame: FrontFrame,
	source: FrontSource,
	anchor: number,
	radiusKm: number,
	theta: number,
	out: Float64Array | Float32Array,
	at = 0,
): void {
	const a = anchor * 3
	const body = frame.bodies[anchor]
	const { positionsKm, displayKm } = frame
	const { origin } = source
	displayOffset(
		origin[0] + radiusKm * Math.cos(theta) - positionsKm[a],
		origin[1] - positionsKm[a + 1],
		origin[2] + radiusKm * Math.sin(theta) - positionsKm[a + 2],
		body.radiusKm,
		frame.displayRadiiKm[anchor],
		childDistanceCurve(frame.scale, anchor === source.root),
		offset,
	)
	out[at] = displayKm[a] + offset[0]
	out[at + 1] = displayKm[a + 1] + offset[1]
	out[at + 2] = displayKm[a + 2] + offset[2]
}

const point = new Float64Array(3)

/**
 * Writes the front at `radiusKm` into `positions` (FRONT_VERTICES x 3 floats,
 * scene units relative to the render origin) and returns how to draw it.
 */
export function writeFront(
	frame: FrontFrame,
	source: FrontSource,
	radiusKm: number,
	positions: Float32Array,
	state: FrontState,
): FrontState {
	state.anchor = frontAnchor(source, radiusKm)
	state.opacity = frontOpacity(source, radiusKm)
	state.visible =
		radiusKm > 0 && radiusKm <= MAX_FRONT_RADIUS_KM && state.opacity > 0
	if (!state.visible) return state
	const { originKm } = frame
	for (let v = 0; v < FRONT_VERTICES; v++) {
		const theta = (v / FRONT_VERTICES) * Math.PI * 2
		frontPointDisplayKm(frame, source, state.anchor, radiusKm, theta, point)
		positions[v * 3] = toUnits(point[0] - originKm[0])
		positions[v * 3 + 1] = toUnits(point[1] - originKm[1])
		positions[v * 3 + 2] = toUnits(point[2] - originKm[2])
	}
	return state
}
