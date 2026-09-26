/**
 * Showing and hiding a body's scene subtree cheaply (#17). three.js recomputes
 * the matrices of every object in the scene every frame, drawn or not; with
 * All moons on, some 150 moons drawn smaller than a pixel (hidden by
 * BodyMesh) would each still cost that work. While hidden, the subtree's
 * matrices are left alone; the first frame it is shown composes them again
 * from its position, rotation and scale, which the caller keeps current.
 */
import type { Object3D } from "three"

/** Sets `object.visible`; on a change, stops or resumes the subtree's automatic matrix updates. */
export function setShown(object: Object3D, shown: boolean): void {
	if (object.visible === shown) return
	object.visible = shown
	object.traverse((node) => {
		node.matrixAutoUpdate = shown
		node.matrixWorldAutoUpdate = shown
	})
}
