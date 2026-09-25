/**
 * Draws the trails of the anchored reference frame (#31, ./trails.ts): one
 * line per top-level body (the Sun and the planets) other than the planet
 * held still, relative to it, fading in with the frame and out along the tail.
 * The selected (or hovered) body's trail is drawn brighter.
 */
import { useEffect, useMemo, useRef } from "react"
import { extend, useFrame } from "@react-three/fiber"
import {
	BufferAttribute,
	Color,
	Line,
	type Group,
	type LineBasicMaterial,
} from "three"

import { useSimStore } from "@/store/sim"
import { useTrailStore } from "@/store/trails"
import { isFrameAnchored } from "@/store/navigation"

import { useSimFrame, type SimFrame } from "../scene/simFrame"
import { anchorWeight } from "./frameBlend"
import {
	TRAIL_COLORS,
	TRAIL_DEFAULT_COLOR,
	TRAIL_VERTICES,
	createTrailBuffers,
	trailAlpha,
	trailBodies,
	updateTrails,
	type TrailBuffers,
} from "./trails"

extend({ ThreeLine: Line })

/** Opacity of a trail that is not the selected or hovered body's. */
export const TRAIL_OPACITY = 0.55
/** The selected or hovered body's trail. */
export const TRAIL_OPACITY_HIGHLIGHT = 1

interface TrailLine {
	body: number
	position: BufferAttribute
	color: BufferAttribute
	rgb: Color
}

/** The top-level body the store's frame holds still, or -1 in the Sun-centred frame. */
export function anchoredTop(frame: SimFrame, frameId: string): number {
	if (!isFrameAnchored({ frameId })) return -1
	const i = frame.index.get(frameId)
	return i === undefined ? -1 : frame.topIndex[i]
}

/** Rewrites the alpha ramp of a trail's colours (vertex count or head side changed). */
function writeColors(line: TrailLine, count: number, headLast: boolean): void {
	const colors = line.color.array as Float32Array
	for (let k = 0; k < count; k++) {
		const c = k * 4
		colors[c] = line.rgb.r
		colors[c + 1] = line.rgb.g
		colors[c + 2] = line.rgb.b
		colors[c + 3] = trailAlpha(k, count, headLast)
	}
	line.color.needsUpdate = true
}

function Trails() {
	const frame = useSimFrame()
	const groupRef = useRef<Group>(null)
	const lineRefs = useRef<(Line | null)[]>([])
	const buffers: TrailBuffers = useMemo(
		() => createTrailBuffers(trailBodies(frame)),
		[frame],
	)
	const lines: TrailLine[] = useMemo(
		() =>
			Array.from(buffers.bodies, (body, t) => ({
				body,
				position: new BufferAttribute(
					buffers.positions.subarray(
						t * TRAIL_VERTICES * 3,
						(t + 1) * TRAIL_VERTICES * 3,
					),
					3,
				),
				color: new BufferAttribute(new Float32Array(TRAIL_VERTICES * 4), 4),
				rgb: new Color(
					TRAIL_COLORS[frame.bodies[body].id] ?? TRAIL_DEFAULT_COLOR,
				),
			})),
		[buffers, frame],
	)
	const colored = useRef({ count: -1, headLast: true })

	// leaving the anchored frame forgets a restart: the next frame shows the full two years
	useEffect(
		() =>
			useSimStore.subscribe((state, previous) => {
				if (!isFrameAnchored(state) && isFrameAnchored(previous)) {
					useTrailStore.getState().clearRestart()
				}
			}),
		[],
	)

	useFrame(() => {
		const group = groupRef.current
		if (group === null) return
		const state = useSimStore.getState()
		const anchor = anchoredTop(frame, state.frameId)
		const weight = anchor < 0 ? 0 : anchorWeight(frame.frameBlend, anchor)
		if (!(weight > 0)) {
			group.visible = false
			if (anchor < 0) updateTrails(buffers, frame, -1, null)
			return
		}
		group.visible = true
		updateTrails(buffers, frame, anchor, useTrailStore.getState().sinceJD)
		frame.renderPosition(anchor, group.position)

		const count = buffers.vertexCount
		const headLast = buffers.headVertex !== 0 || count <= 1
		const recolor =
			colored.current.count !== count || colored.current.headLast !== headLast
		colored.current.count = count
		colored.current.headLast = headLast
		const highlightId = state.hoverId ?? state.selectedId
		const highlight =
			highlightId === null ? -1 : (frame.index.get(highlightId) ?? -1)
		const highlightTop = highlight < 0 ? -1 : frame.topIndex[highlight]

		lines.forEach((line, t) => {
			const object = lineRefs.current[t]
			if (object === null || object === undefined) return
			object.visible = line.body !== anchor && count > 1
			if (!object.visible) return
			if (recolor) writeColors(line, count, headLast)
			line.position.needsUpdate = true
			object.geometry.setDrawRange(0, count)
			const material = object.material as LineBasicMaterial
			material.opacity =
				weight *
				(line.body === highlightTop ? TRAIL_OPACITY_HIGHLIGHT : TRAIL_OPACITY)
		})
	})

	return (
		<group ref={groupRef} visible={false}>
			{lines.map((line, t) => (
				<threeLine
					key={line.body}
					ref={(object: Line | null) => {
						lineRefs.current[t] = object
					}}
					frustumCulled={false}
					renderOrder={-1}
				>
					<bufferGeometry>
						<primitive attach="attributes-position" object={line.position} />
						<primitive attach="attributes-color" object={line.color} />
					</bufferGeometry>
					<lineBasicMaterial
						vertexColors
						transparent
						depthWrite={false}
						opacity={TRAIL_OPACITY}
					/>
				</threeLine>
			))}
		</group>
	)
}

export default Trails
