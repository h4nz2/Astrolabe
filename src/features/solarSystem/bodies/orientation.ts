/**
 * The one authority on how a body is oriented in the scene (docs/ARCHITECTURE.md,
 * "Rotation"; issues #13, #12). Two layers:
 *
 * - The POLE FRAME (`bodyOrientation`): constant per body. Local +X = equatorNode
 *   (where the prime meridian angle is counted from), +Y = spinAxis (the IAU north
 *   pole), +Z = X x Y. The local XZ plane is the body's equator. Anything that follows
 *   the tilt but not the spin lives here: rings (#12), equatorial markers, a pole line.
 *   BodyMesh's <group> carries this quaternion, so a child of that group is in it.
 * - The SPIN (`bodySpinAngle`): an angle about local +Y, turning the surface. The
 *   textured mesh is the only thing that spins. `bodySurfaceOrientation` composes both
 *   for anything fixed to the surface (a city marker, a landing site).
 *
 * A texture's equirectangular map lines up with this frame: three's SphereGeometry puts
 * u = 0.5 (longitude 0, the prime meridian) on local +X, u = 0.75 (east) on local -Z and
 * the north pole on +Y, and a positive spin turns +X toward -Z, i.e. eastward.
 */
import { Matrix4, Quaternion, Vector3 } from "three"

import type { Body } from "@/data"
import {
	equatorNode,
	rotationAngle,
	spinAxis,
	synchronousAngle,
	type Vec3,
} from "@/sim"

import type { SimFrame } from "../scene/simFrame"

/** Quaternion that takes the pole frame to the scene frame; a new one unless `out` is given. */
export function bodyOrientation(
	body: Pick<Body, "rotation" | "orbit">,
	out: Quaternion = new Quaternion(),
): Quaternion {
	const x = new Vector3()
	const y = new Vector3()
	equatorNode(body.rotation, body.orbit, x)
	spinAxis(body.rotation, body.orbit, y)
	const z = new Vector3().crossVectors(x, y)
	return out.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z))
}

/** What `bodySpinAngle` needs about one body, built once (`createBodySpin`). */
export interface BodySpin {
	readonly index: number
	/** Index of the parent a synchronous body faces, else -1. */
	readonly parentIndex: number
	/** Scene-frame pole and equator node (the pole frame's +Y and +X). */
	readonly axis: Vec3
	readonly node: Vec3
	/** Scratch vector for the direction to the parent; the frame loop allocates nothing. */
	readonly toParent: Vec3
}

export function createBodySpin(
	body: Pick<Body, "rotation" | "orbit" | "parentId">,
	index: number,
	frame: Pick<SimFrame, "index">,
): BodySpin {
	const parentIndex =
		body.rotation.synchronous === true && body.parentId !== null
			? (frame.index.get(body.parentId) ?? -1)
			: -1
	return {
		index,
		parentIndex,
		axis: spinAxis(body.rotation, body.orbit),
		node: equatorNode(body.rotation, body.orbit),
		toParent: { x: 0, y: 0, z: 0 },
	}
}

/**
 * The body's spin angle this frame, radians about the pole frame's +Y. A synchronous
 * (tidally locked) body turns its prime meridian toward its parent, from the TRUE
 * positions (directions are true in every scale preset), whatever the spin mode. Every
 * other body turns by `rotationAngle` at the frame's spin time (`frame.spinJD`: the
 * simulation time in the realistic spin mode, src/sim/spin.ts).
 */
export function bodySpinAngle(
	body: Pick<Body, "rotation">,
	spin: BodySpin,
	frame: Pick<SimFrame, "positionsKm" | "spinJD">,
): number {
	if (spin.parentIndex < 0) return rotationAngle(body.rotation, frame.spinJD)
	const p = frame.positionsKm
	const o = spin.index * 3
	const q = spin.parentIndex * 3
	spin.toParent.x = p[q] - p[o]
	spin.toParent.y = p[q + 1] - p[o + 1]
	spin.toParent.z = p[q + 2] - p[o + 2]
	return synchronousAngle(spin.axis, spin.node, spin.toParent)
}

const LOCAL_Y = new Vector3(0, 1, 0)
const spinQuaternion = new Quaternion()

/**
 * Pole frame then spin: the quaternion taking surface-fixed coordinates (the mesh's local
 * frame, texture-aligned) to the scene frame. `poleFrame` is `bodyOrientation(body)`.
 */
export function bodySurfaceOrientation(
	poleFrame: Quaternion,
	spinAngle: number,
	out: Quaternion = new Quaternion(),
): Quaternion {
	spinQuaternion.setFromAxisAngle(LOCAL_Y, spinAngle)
	return out.copy(poleFrame).multiply(spinQuaternion)
}
