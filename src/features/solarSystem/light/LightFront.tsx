/**
 * The light pulse in the scene (#27): a bright circle where the light sphere
 * cuts the plane of the planets, a faint glow over everything it has already
 * passed, and a label riding on it with the time the light has been
 * travelling. The geometry is `writeFront` (lightFront.ts), rewritten every
 * frame from the SimFrame and the simulation time, so the front pauses,
 * speeds up and runs backwards with the clock.
 */
import { useEffect, useMemo, useRef, type RefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import {
	BufferAttribute,
	BufferGeometry,
	Color,
	Group,
	LineBasicMaterial,
	LineLoop,
	Mesh,
	MeshBasicMaterial,
	DoubleSide,
} from "three"

import { useI18n } from "@/i18n"
import { frontRadiusKm, secondsSince } from "@/sim/light"
import { toUnits } from "@/sim"
import { useLightStore, type LightPulse } from "@/store/light"

import { useSimFrame, type SimFrame } from "../scene/simFrame"
import {
	FRONT_VERTICES,
	frontPointDisplayKm,
	frontSource,
	writeFront,
	type FrontSource,
	type FrontState,
} from "./lightFront"
import { formatDuration, pulseTargetIds } from "./lightTravel"

import classes from "./LightFront.module.css"

export const FRONT_COLOR = "#ffe7a3"
/** Opacity of the glow at the front's edge (it fades to 0 toward the source). */
export const GLOW_OPACITY = 0.16

interface FrontObjects {
	line: LineLoop
	glow: Mesh
	positions: Float32Array
	glowPositions: Float32Array
	lineMaterial: LineBasicMaterial
	glowMaterial: MeshBasicMaterial
}

/** The line loop and the glow fan sharing the front's vertices (the fan adds the centre as vertex 0). */
const createFrontObjects = (): FrontObjects => {
	const positions = new Float32Array(FRONT_VERTICES * 3)
	const lineGeometry = new BufferGeometry()
	lineGeometry.setAttribute("position", new BufferAttribute(positions, 3))
	const lineMaterial = new LineBasicMaterial({
		color: new Color(FRONT_COLOR),
		transparent: true,
		depthWrite: false,
	})
	const line = new LineLoop(lineGeometry, lineMaterial)
	line.frustumCulled = false
	line.renderOrder = 2

	const glowPositions = new Float32Array((FRONT_VERTICES + 1) * 3)
	const colors = new Float32Array((FRONT_VERTICES + 1) * 4)
	const color = new Color(FRONT_COLOR)
	for (let v = 0; v <= FRONT_VERTICES; v++) {
		colors[v * 4] = color.r
		colors[v * 4 + 1] = color.g
		colors[v * 4 + 2] = color.b
		colors[v * 4 + 3] = v === 0 ? 0 : 1
	}
	const indices: number[] = []
	for (let v = 0; v < FRONT_VERTICES; v++) {
		indices.push(0, v + 1, ((v + 1) % FRONT_VERTICES) + 1)
	}
	const glowGeometry = new BufferGeometry()
	glowGeometry.setAttribute("position", new BufferAttribute(glowPositions, 3))
	glowGeometry.setAttribute("color", new BufferAttribute(colors, 4))
	glowGeometry.setIndex(indices)
	const glowMaterial = new MeshBasicMaterial({
		vertexColors: true,
		transparent: true,
		depthWrite: false,
		side: DoubleSide,
		opacity: GLOW_OPACITY,
	})
	const glow = new Mesh(glowGeometry, glowMaterial)
	glow.frustumCulled = false
	glow.renderOrder = 1
	return { line, glow, positions, glowPositions, lineMaterial, glowMaterial }
}

const centre = new Float64Array(3)
const labelPoint = new Float64Array(3)

/**
 * Per frame: the front's vertices, the glow fan and the label's position.
 * Returns whether anything is drawn.
 */
export function updateFront(
	frame: SimFrame,
	source: FrontSource,
	pulse: LightPulse,
	towardIndex: number,
	objects: FrontObjects,
	state: FrontState,
	label: Group,
): boolean {
	const radiusKm = frontRadiusKm(pulse.emitJD, frame.jd)
	writeFront(frame, source, radiusKm, objects.positions, state)
	objects.line.visible = state.visible
	objects.glow.visible = state.visible
	if (!state.visible) return false

	const { originKm } = frame
	// the glow fan: the source's point as drawn in the middle, then the front
	frontPointDisplayKm(frame, source, state.anchor, 0, 0, centre)
	objects.glowPositions[0] = toUnits(centre[0] - originKm[0])
	objects.glowPositions[1] = toUnits(centre[1] - originKm[1])
	objects.glowPositions[2] = toUnits(centre[2] - originKm[2])
	objects.glowPositions.set(objects.positions, 3)
	objects.line.geometry.attributes.position.needsUpdate = true
	objects.glow.geometry.attributes.position.needsUpdate = true
	objects.lineMaterial.opacity = state.opacity
	objects.glowMaterial.opacity = GLOW_OPACITY * state.opacity

	// the label rides on the front where it heads for the next body it reaches
	const t = towardIndex * 3
	const theta = Math.atan2(
		frame.positionsKm[t + 2] - source.origin[2],
		frame.positionsKm[t] - source.origin[0],
	)
	frontPointDisplayKm(frame, source, state.anchor, radiusKm, theta, labelPoint)
	label.position.set(
		toUnits(labelPoint[0] - originKm[0]),
		toUnits(labelPoint[1] - originKm[1]),
		toUnits(labelPoint[2] - originKm[2]),
	)
	return true
}

const disposeFront = (objects: FrontObjects): void => {
	objects.line.geometry.dispose()
	objects.glow.geometry.dispose()
	objects.lineMaterial.dispose()
	objects.glowMaterial.dispose()
}

/**
 * Index of the body the label heads for: the nearest target the light has not
 * reached yet, else the farthest one.
 */
export function nextTarget(
	frame: SimFrame,
	source: FrontSource,
	targets: readonly number[],
	radiusKm: number,
): number {
	let toward = targets[targets.length - 1] ?? source.root
	let best = Infinity
	for (const i of targets) {
		const o = i * 3
		const d = Math.hypot(
			frame.positionsKm[o] - source.origin[0],
			frame.positionsKm[o + 1] - source.origin[1],
			frame.positionsKm[o + 2] - source.origin[2],
		)
		if (d > radiusKm && d < best) {
			best = d
			toward = i
		}
	}
	return toward
}

/** The whole per-frame update: front, glow, label position and its visibility. */
function drawFront(
	frame: SimFrame,
	pulse: LightPulse | null,
	source: FrontSource | null,
	targets: readonly number[],
	objects: FrontObjects,
	state: FrontState,
	label: Group | null,
	text: HTMLSpanElement | null,
): void {
	let shown = false
	if (pulse !== null && source !== null && label !== null) {
		const toward = nextTarget(
			frame,
			source,
			targets,
			frontRadiusKm(pulse.emitJD, frame.jd),
		)
		shown = updateFront(frame, source, pulse, toward, objects, state, label)
	} else {
		objects.line.visible = false
		objects.glow.visible = false
	}
	if (text !== null) {
		text.style.visibility = shown ? "visible" : "hidden"
		text.style.opacity = String(state.opacity)
	}
}

/** The text on the front: "Light · 4 min 12 s", refreshed at most 10 times a second. */
const FrontLabel = ({
	pulse,
	ref,
}: {
	pulse: LightPulse
	ref: RefObject<HTMLSpanElement | null>
}) => {
	const i18n = useI18n()
	const frame = useSimFrame()
	useEffect(() => {
		const write = () => {
			if (ref.current === null) return
			const seconds = secondsSince(pulse.emitJD, frame.jd)
			ref.current.textContent = i18n.t("solarSystem.light.frontLabel", {
				duration: formatDuration(seconds, i18n, true),
			})
		}
		write()
		const timer = setInterval(write, 100)
		return () => clearInterval(timer)
	}, [pulse, frame, i18n, ref])
	return <span ref={ref} className={classes.label} data-light-front-label />
}

function LightFront() {
	const frame = useSimFrame()
	const pulse = useLightStore((state) => state.pulse)
	const objects = useMemo(() => createFrontObjects(), [])
	const labelRef = useRef<Group>(null)
	const textRef = useRef<HTMLSpanElement>(null)
	const state = useMemo<FrontState>(
		() => ({ visible: false, opacity: 0, anchor: 0 }),
		[],
	)
	const source = useMemo(() => {
		if (pulse === null) return null
		const emitter = frame.index.get(pulse.emitterId)
		if (emitter === undefined) return null
		return frontSource(frame.bodies, frame.index, emitter, pulse.emitJD)
	}, [pulse, frame])
	const targets = useMemo(
		() =>
			pulse === null
				? []
				: pulseTargetIds(pulse.emitterId).map((id) => frame.index.get(id)!),
		[pulse, frame],
	)

	useEffect(() => () => disposeFront(objects), [objects])

	useFrame(() =>
		drawFront(
			frame,
			pulse,
			source,
			targets,
			objects,
			state,
			labelRef.current,
			textRef.current,
		),
	)

	return (
		<>
			<primitive object={objects.glow} />
			<primitive object={objects.line} />
			<group ref={labelRef}>
				{pulse !== null && (
					<Html center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
						<FrontLabel pulse={pulse} ref={textRef} />
					</Html>
				)}
			</group>
		</>
	)
}

export default LightFront
