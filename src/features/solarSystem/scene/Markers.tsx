/**
 * One Points layer with a round, screen-sized dot per body, so nothing
 * vanishes at true scale (docs/ARCHITECTURE.md, "Rendering"). Vertices are
 * compacted every frame from the SimFrame: hidden moons, moons outside the
 * focus family (they would collapse into a blob around their planet from afar)
 * and bodies whose disc is already bigger than the dot are skipped. With
 * `showMarkers` off nothing is drawn, so small bodies shrink to their true
 * size and vanish. The dots are not picked themselves: `BodyPicking` gives
 * every body a generous target of its own, drawn dot or not (#16).
 */
import { useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { PerspectiveCamera, Vector3, type Camera, type Points } from "three"

import type { Body, BodyKind } from "@/data"
import { isBodyShown, useSimStore, type SimState } from "@/store/sim"

import { pixelsPerUnitAtDistanceOne } from "./picking"
import { useSimFrame, type SimFrame } from "./simFrame"

export const MARKER_SIZE_PX = 4
/** The dot disappears once the body's own disc is wider than this on screen (px). */
export const MARKER_HIDE_DIAMETER_PX = 6

const MARKER_COLORS: Record<BodyKind, readonly [number, number, number]> = {
	star: [1, 0.85, 0.4],
	planet: [1, 1, 1],
	moon: [0.62, 0.65, 0.7],
}

const scratch = new Vector3()

/**
 * GL points are squares: cuts each into a disc whose edge is anti-aliased by
 * its pixel coverage (the distance to the centre over its screen derivative).
 */
const roundPoints = (shader: { fragmentShader: string }) => {
	shader.fragmentShader = shader.fragmentShader.replace(
		"#include <color_fragment>",
		`#include <color_fragment>
	float markerRadius = length( gl_PointCoord - 0.5 ) * 2.0;
	diffuseColor.a *= clamp( 0.5 + ( 1.0 - markerRadius ) / fwidth( markerRadius ), 0.0, 1.0 );
	if ( diffuseColor.a <= 0.0 ) discard;`,
	)
}

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
			(2 * frame.renderRadius(i) * pxPerUnit) / distance >
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

function Markers() {
	const frame = useSimFrame()
	const pointsRef = useRef<Points>(null)
	const heightPx = useThree((state) => state.size.height)
	const count = frame.bodies.length
	const buffers = useMemo(() => createMarkerBuffers(count), [count])
	const { positions, colors } = buffers

	useFrame(({ camera }) => {
		const points = pointsRef.current
		if (points === null) return
		const state = useSimStore.getState()
		const drawn = state.showMarkers
			? fillMarkers(buffers, frame, camera, heightPx, state)
			: 0
		const geometry = points.geometry
		geometry.setDrawRange(0, drawn)
		geometry.attributes.position.needsUpdate = true
		geometry.attributes.color.needsUpdate = true
	})

	return (
		<points ref={pointsRef} frustumCulled={false} renderOrder={1}>
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
				onBeforeCompile={roundPoints}
			/>
		</points>
	)
}

export default Markers
