/**
 * Constant orientation of a body's mesh: local +X = equatorNode, +Y = spinAxis
 * (IAU north pole), +Z = X x Y (docs/ARCHITECTURE.md, "Simulation"). The mesh
 * then spins about its local Y by `rotationAngle()` every frame.
 */
import { Matrix4, Quaternion, Vector3 } from "three"

import type { Body } from "@/data"
import { equatorNode, spinAxis } from "@/sim"

/** Quaternion that takes the mesh frame to the scene frame; a new one unless `out` is given. */
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
