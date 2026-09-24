/**
 * World positions of the body hierarchy and the floating-origin primitive.
 *
 * `computePositions` walks the bodies in topological order (every parent before
 * its children, as bodies.json guarantees) and writes each body's world
 * position in km, scene frame, as three consecutive doubles into a
 * Float64Array: world(child) = world(parent) + propagate(child.orbit, jd).
 *
 * GPU positions are float32, so a Sun-centred coordinate at Neptune's distance
 * is only good to a few hundred km. The renderer therefore subtracts a render
 * origin in doubles first and only then converts to scene units; that is what
 * relativePosition() / relativeToOrigin() do.
 */
import { propagate, type OrbitElements, type Vec3 } from "./kepler"
import { toUnits } from "./units"

/** The subset of a `Body` that positioning needs. A schema `Body` satisfies it. */
export interface OrbitingBody {
	readonly id: string
	/** null only for the root (the Sun), which sits at the world origin. */
	readonly parentId: string | null
	/** null for the root; a body with a parent but no orbit sits on its parent. */
	readonly orbit: OrbitElements | null
}

/** Anything with numeric index access to write x, y, z into (Float64Array, Float32Array, number[]). */
export type WritableVec3 = { [index: number]: number }

/** Maps body id -> index into `bodies` (and into the positions array, times 3). */
export function buildIndex(
	bodies: readonly { readonly id: string }[],
): Map<string, number> {
	const index = new Map<string, number>()
	bodies.forEach((body, i) => {
		if (index.has(body.id)) {
			throw new Error(`buildIndex: duplicate body id "${body.id}"`)
		}
		index.set(body.id, i)
	})
	return index
}

// Reused by every propagate() call so the per-frame path does not allocate.
const scratch: Vec3 = { x: 0, y: 0, z: 0 }

/**
 * Fills world positions (km, scene frame) for every body at Julian Date `jd`.
 *
 * @param bodies topological order: a body's parent must precede it
 * @param jd     simulation time
 * @param out    reused when given and long enough (>= 3 * bodies.length), else a new array is allocated
 * @param index  optional prebuilt `buildIndex(bodies)` of this same array; pass it from per-frame code to skip rebuilding the map
 * @returns the array that was written (`out` or the new one), 3 doubles per body in `bodies` order
 * @throws Error when a parent id is unknown or comes after its child (data is not topological),
 *         or when `index` was built from a different array (its size does not match `bodies`)
 */
export function computePositions(
	bodies: readonly OrbitingBody[],
	jd: number,
	out?: Float64Array,
	index: ReadonlyMap<string, number> = buildIndex(bodies),
): Float64Array {
	if (index.size !== bodies.length) {
		throw new Error(
			`computePositions: index has ${index.size} entries for ${bodies.length} bodies; build it with buildIndex(bodies) of the same array`,
		)
	}
	const needed = bodies.length * 3
	const positions =
		out !== undefined && out.length >= needed ? out : new Float64Array(needed)

	for (let i = 0; i < bodies.length; i++) {
		const body = bodies[i]
		let px = 0
		let py = 0
		let pz = 0
		if (body.parentId !== null) {
			const p = index.get(body.parentId)
			if (p === undefined) {
				throw new Error(
					`computePositions: "${body.id}" has unknown parent "${body.parentId}"`,
				)
			}
			if (p >= i) {
				throw new Error(
					`computePositions: bodies are not in topological order, "${body.id}" (#${i}) comes before its parent "${body.parentId}" (#${p})`,
				)
			}
			px = positions[p * 3]
			py = positions[p * 3 + 1]
			pz = positions[p * 3 + 2]
		}
		const o = i * 3
		if (body.orbit === null) {
			positions[o] = px
			positions[o + 1] = py
			positions[o + 2] = pz
		} else {
			propagate(body.orbit, jd, scratch)
			positions[o] = px + scratch.x
			positions[o + 1] = py + scratch.y
			positions[o + 2] = pz + scratch.z
		}
	}
	return positions
}

/**
 * Floating-origin primitive: position of body `i` relative to body
 * `originIndex`, converted to scene units. The subtraction happens in doubles
 * so that distant bodies keep their precision near the origin.
 *
 * @param positions array written by computePositions()
 * @param target    receives [x, y, z]; a new Float64Array(3) when omitted
 */
export function relativePosition(
	positions: Float64Array,
	i: number,
	originIndex: number,
): Float64Array
export function relativePosition<T extends WritableVec3>(
	positions: Float64Array,
	i: number,
	originIndex: number,
	target: T,
): T
export function relativePosition(
	positions: Float64Array,
	i: number,
	originIndex: number,
	target: WritableVec3 = new Float64Array(3),
): WritableVec3 {
	const a = i * 3
	const b = originIndex * 3
	target[0] = toUnits(positions[a] - positions[b])
	target[1] = toUnits(positions[a + 1] - positions[b + 1])
	target[2] = toUnits(positions[a + 2] - positions[b + 2])
	return target
}

/**
 * Same as relativePosition() but against an arbitrary origin in world km,
 * for the fly-to blend between two focus bodies.
 *
 * @param originKm [x, y, z] in world km (scene frame)
 */
export function relativeToOrigin(
	positions: Float64Array,
	i: number,
	originKm: ArrayLike<number>,
): Float64Array
export function relativeToOrigin<T extends WritableVec3>(
	positions: Float64Array,
	i: number,
	originKm: ArrayLike<number>,
	target: T,
): T
export function relativeToOrigin(
	positions: Float64Array,
	i: number,
	originKm: ArrayLike<number>,
	target: WritableVec3 = new Float64Array(3),
): WritableVec3 {
	const a = i * 3
	target[0] = toUnits(positions[a] - originKm[0])
	target[1] = toUnits(positions[a + 1] - originKm[1])
	target[2] = toUnits(positions[a + 2] - originKm[2])
	return target
}
