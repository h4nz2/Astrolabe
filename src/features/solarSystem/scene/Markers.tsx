/**
 * One Points layer with a screen-sized dot per body, so nothing vanishes at
 * true scale (docs/ARCHITECTURE.md, "Rendering"). Vertices are compacted every
 * frame from the SimFrame: hidden moons, moons outside the focus family (they
 * would collapse into a blob around their planet from afar) and bodies whose
 * disc is already bigger than the dot are skipped. Picking is angular (a pixel
 * radius around the pointer ray) instead of three's world-unit Points
 * threshold, which is meaningless across ten orders of magnitude of distance.
 */
import { useCallback, useMemo, useRef } from "react"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import {
	PerspectiveCamera,
	Vector3,
	type Camera,
	type Intersection,
	type Points,
	type Raycaster,
} from "three"

import type { Body, BodyKind } from "@/data"
import { degToRad, toUnits } from "@/sim"
import { isBodyShown, useSimStore, type SimState } from "@/store/sim"

import { CLICK_MAX_DRAG_PX } from "../bodies/BodyMesh"
import { useSimFrame, type SimFrame } from "./simFrame"

export const MARKER_SIZE_PX = 4
/** Pointer radius (px) that still hits a dot. */
export const MARKER_PICK_RADIUS_PX = 10
/** The dot disappears once the body's own disc is wider than this on screen (px). */
export const MARKER_HIDE_DIAMETER_PX = 6

const MARKER_COLORS: Record<BodyKind, readonly [number, number, number]> = {
	star: [1, 0.85, 0.4],
	planet: [1, 1, 1],
	moon: [0.62, 0.65, 0.7],
}

const scratch = new Vector3()

/** Pixels per scene unit at unit distance from a perspective camera. */
const pixelsPerUnitAtDistanceOne = (
	camera: PerspectiveCamera,
	heightPx: number,
): number => heightPx / (2 * Math.tan(degToRad(camera.fov / 2)))

export interface MarkerBuffers {
	/** float32 render positions, 3 per drawn vertex */
	positions: Float32Array
	/** rgb per drawn vertex */
	colors: Float32Array
	/** body index behind each drawn vertex */
	vertexBody: Int32Array
}

export const createMarkerBuffers = (count: number): MarkerBuffers => ({
	positions: new Float32Array(count * 3),
	colors: new Float32Array(count * 3),
	vertexBody: new Int32Array(count),
})

/**
 * A moon's dot is drawn only while its parent or a sibling (or the moon
 * itself) is the focus, the same family rule the labels use: from anywhere
 * else the moons of a planet sit within a few pixels of it and would only
 * bury the planet's own dot.
 */
export const isMoonDotShown = (
	moon: Pick<Body, "id" | "parentId">,
	focusId: string,
	focusParentId: string | null,
): boolean =>
	moon.id === focusId ||
	moon.parentId === focusId ||
	moon.parentId === focusParentId

/**
 * Compacts the visible bodies into the buffers and returns how many vertices
 * to draw. Moons are skipped while hidden (except the focus) or outside the
 * focus family, and so is any body whose disc is already wider than the dot.
 */
export function fillMarkers(
	buffers: MarkerBuffers,
	frame: SimFrame,
	camera: Camera,
	heightPx: number,
	state: Pick<SimState, "showMoons" | "focusId">,
): number {
	const { positions, colors, vertexBody } = buffers
	const pxPerUnit =
		camera instanceof PerspectiveCamera
			? pixelsPerUnitAtDistanceOne(camera, heightPx)
			: 0
	const focusIndex = frame.index.get(state.focusId)
	const focusParentId =
		focusIndex === undefined ? null : frame.bodies[focusIndex].parentId
	let drawn = 0
	for (let i = 0; i < frame.bodies.length; i++) {
		const body = frame.bodies[i]
		if (!isBodyShown(body, state)) continue
		if (
			body.kind === "moon" &&
			!isMoonDotShown(body, state.focusId, focusParentId)
		) {
			continue
		}
		frame.renderPosition(i, scratch)
		const distance = scratch.distanceTo(camera.position)
		if (
			distance > 0 &&
			(2 * toUnits(body.radiusKm) * pxPerUnit) / distance >
				MARKER_HIDE_DIAMETER_PX
		) {
			continue
		}
		const v = drawn * 3
		positions[v] = scratch.x
		positions[v + 1] = scratch.y
		positions[v + 2] = scratch.z
		const color = MARKER_COLORS[body.kind]
		colors[v] = color[0]
		colors[v + 1] = color[1]
		colors[v + 2] = color[2]
		vertexBody[drawn] = i
		drawn++
	}
	return drawn
}

/**
 * The drawn vertex the ray points at, or -1: the dot closest to the ray
 * within `MARKER_PICK_RADIUS_PX` (`anglePerPx` converts pixels to angle). A
 * planet or the Sun inside the radius beats every moon, however much closer a
 * moon's dot is, so a planet's moons never steal its click from afar.
 */
export function pickMarker(
	buffers: MarkerBuffers,
	drawn: number,
	bodies: readonly Body[],
	origin: Vector3,
	direction: Vector3,
	anglePerPx: number,
): number {
	const { positions, vertexBody } = buffers
	const pickTanSq = (MARKER_PICK_RADIUS_PX * anglePerPx) ** 2
	let bestMajor = -1
	let bestMajorTanSq = pickTanSq
	let bestMoon = -1
	let bestMoonTanSq = pickTanSq
	for (let v = 0; v < drawn; v++) {
		const o = v * 3
		const dx = positions[o] - origin.x
		const dy = positions[o + 1] - origin.y
		const dz = positions[o + 2] - origin.z
		const along = dx * direction.x + dy * direction.y + dz * direction.z
		if (along <= 0) continue
		const distanceSq = dx * dx + dy * dy + dz * dz
		const perpSq = Math.max(0, distanceSq - along * along)
		const tanSq = perpSq / (along * along)
		if (bodies[vertexBody[v]].kind === "moon") {
			if (tanSq < bestMoonTanSq) {
				bestMoon = v
				bestMoonTanSq = tanSq
			}
		} else if (tanSq < bestMajorTanSq) {
			bestMajor = v
			bestMajorTanSq = tanSq
		}
	}
	return bestMajor >= 0 ? bestMajor : bestMoon
}

function Markers() {
	const frame = useSimFrame()
	const pointsRef = useRef<Points>(null)
	const heightPx = useThree((state) => state.size.height)
	const count = frame.bodies.length
	const buffers = useMemo(() => createMarkerBuffers(count), [count])
	const { positions, colors, vertexBody } = buffers

	useFrame(({ camera }) => {
		const points = pointsRef.current
		if (points === null) return
		const drawn = fillMarkers(
			buffers,
			frame,
			camera,
			heightPx,
			useSimStore.getState(),
		)
		const geometry = points.geometry
		geometry.setDrawRange(0, drawn)
		geometry.attributes.position.needsUpdate = true
		geometry.attributes.color.needsUpdate = true
	})

	const raycast = useCallback(
		(raycaster: Raycaster, intersects: Intersection[]) => {
			const points = pointsRef.current
			if (points === null) return
			const camera = raycaster.camera
			if (!(camera instanceof PerspectiveCamera)) return
			const drawn = Math.min(points.geometry.drawRange.count, count)
			const { origin, direction } = raycaster.ray
			const best = pickMarker(
				buffers,
				drawn,
				frame.bodies,
				origin,
				direction,
				1 / pixelsPerUnitAtDistanceOne(camera, heightPx),
			)
			if (best < 0) return
			const o = best * 3
			const point = new Vector3(
				positions[o],
				positions[o + 1],
				positions[o + 2],
			)
			const distance = point.distanceTo(origin)
			const along = point.clone().sub(origin).dot(direction)
			intersects.push({
				distance,
				distanceToRay: Math.sqrt(Math.max(0, distance ** 2 - along ** 2)),
				point,
				index: vertexBody[best],
				object: points,
			})
		},
		[buffers, count, frame.bodies, heightPx, positions, vertexBody],
	)

	const bodyIdAt = (event: ThreeEvent<MouseEvent | PointerEvent>) => {
		const index = event.index
		return index === undefined ? null : (frame.bodies[index]?.id ?? null)
	}
	const onClick = (event: ThreeEvent<MouseEvent>) => {
		if (event.delta > CLICK_MAX_DRAG_PX) return
		const id = bodyIdAt(event)
		if (id === null) return
		event.stopPropagation()
		useSimStore.getState().setFocus(id)
	}
	const onPointerOver = (event: ThreeEvent<PointerEvent>) => {
		const id = bodyIdAt(event)
		if (id === null) return
		event.stopPropagation()
		useSimStore.getState().setHover(id)
	}
	const onPointerOut = (event: ThreeEvent<PointerEvent>) => {
		const store = useSimStore.getState()
		if (store.hoverId !== null && store.hoverId === bodyIdAt(event)) {
			store.setHover(null)
		}
	}

	return (
		<points
			ref={pointsRef}
			frustumCulled={false}
			renderOrder={1}
			raycast={raycast}
			onClick={onClick}
			onPointerOver={onPointerOver}
			onPointerOut={onPointerOut}
		>
			<bufferGeometry>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} />
				<bufferAttribute attach="attributes-color" args={[colors, 3]} />
			</bufferGeometry>
			<pointsMaterial
				size={MARKER_SIZE_PX}
				sizeAttenuation={false}
				vertexColors
				transparent
				depthTest={false}
				depthWrite={false}
			/>
		</points>
	)
}

export default Markers
