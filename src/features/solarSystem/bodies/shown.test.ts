import { describe, expect, it } from "vitest"
import { Group, Mesh, Scene, Vector3 } from "three"

import { setShown } from "./shown"

const moon = () => {
	const scene = new Scene()
	const group = new Group()
	const mesh = new Mesh()
	group.add(mesh)
	scene.add(group)
	return { scene, group, mesh }
}

const worldPosition = (mesh: Mesh) =>
	new Vector3().setFromMatrixPosition(mesh.matrixWorld)

describe("setShown", () => {
	it("leaves a hidden subtree's matrices alone, and composes them again when shown", () => {
		const { scene, group, mesh } = moon()
		group.position.set(1, 2, 3)
		scene.updateMatrixWorld()
		expect(worldPosition(mesh)).toEqual(new Vector3(1, 2, 3))

		setShown(group, false)
		expect(group.visible).toBe(false)
		// the body keeps being placed while hidden; nothing is recomputed for it
		group.position.set(4, 5, 6)
		scene.updateMatrixWorld()
		expect(worldPosition(mesh)).toEqual(new Vector3(1, 2, 3))

		setShown(group, true)
		expect(group.visible).toBe(true)
		scene.updateMatrixWorld()
		expect(worldPosition(mesh)).toEqual(new Vector3(4, 5, 6))
	})

	it("does nothing when the visibility does not change", () => {
		const { group, mesh } = moon()
		mesh.matrixAutoUpdate = false
		setShown(group, true)
		expect(mesh.matrixAutoUpdate).toBe(false)
	})
})
