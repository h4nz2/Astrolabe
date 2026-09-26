/**
 * The asteroid belt and the Kuiper belt (#23): one Points object per belt, each dot on
 * its own Kepler orbit, moved and scaled on the GPU (beltShader.ts), plus the belt's name
 * written on it in wide views. Shown with the "Small bodies" layer.
 *
 * Honest by construction: a dot is a few pixels whatever the zoom, so flying into the
 * belt never turns it into the rock field of the films; it stays a sparse scatter, and the
 * HUD note (SmallBodiesNote.tsx) says how many real asteroids each dot stands for and how
 * far apart they are.
 */
import { useEffect, useMemo } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import {
	BufferAttribute,
	BufferGeometry,
	NormalBlending,
	PerspectiveCamera,
	Points,
	ShaderMaterial,
	Vector3,
	type Camera,
} from "three"

import { belts, bodyById, type Belt } from "@/data"
import { useI18n } from "@/i18n"
import { rootIndexOf } from "@/sim"
import { generateBeltOrbits } from "@/sim/belts"
import { useSimStore } from "@/store/sim"

import { pixelsPerUnitAtDistanceOne } from "../scene/picking"
import {
	FRAME_BLEND_SLOTS,
	useSimFrame,
	type SimFrame,
} from "../scene/simFrame"
import { beltFragmentShader, beltVertexShader } from "./beltShader"
import {
	beltLabelPosition,
	beltMidRadiusKm,
	createBeltUniforms,
	hexToRgb,
	updateBeltUniforms,
	type BeltUniforms,
} from "./belts"

import classes from "./SmallBodies.module.css"

/** A belt's name shows while the belt's middle circle is at least this wide on screen (px radius)... */
export const BELT_LABEL_MIN_PX = 70
/** ...and at most this many viewport heights (inside the belt the name says nothing). */
export const BELT_LABEL_MAX_VIEWPORTS = 1.2

const createBeltPoints = (belt: Belt): Points => {
	const parent = bodyById.get(belt.parentId)
	const orbits = generateBeltOrbits(belt, parent?.massKg ?? 1.989e30)
	const geometry = new BufferGeometry()
	// three needs a position attribute for the draw count; the shader ignores it
	geometry.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(orbits.count * 3), 3),
	)
	geometry.setAttribute("aOrbit", new BufferAttribute(orbits.elements, 4))
	geometry.setAttribute("aPeriapsis", new BufferAttribute(orbits.periapsis, 3))
	geometry.setAttribute("aAhead", new BufferAttribute(orbits.ahead, 3))
	const material = new ShaderMaterial({
		uniforms: {
			...createBeltUniforms(hexToRgb(belt.color), FRAME_BLEND_SLOTS),
		},
		vertexShader: beltVertexShader,
		fragmentShader: beltFragmentShader,
		transparent: true,
		depthWrite: false,
		blending: NormalBlending,
	})
	const points = new Points(geometry, material)
	points.frustumCulled = false
	points.name = `belt-${belt.id}`
	return points
}

const centre = new Vector3()
const labelAt = new Vector3()
const side = new Vector3()
const projected = new Vector3()

/** The belt's name element (plain DOM beside the canvas, removed with a guard on unmount). */
const createBeltLabel = (beltId: string): HTMLSpanElement => {
	const label = document.createElement("span")
	label.className = classes.beltLabel
	label.dataset.belt = beltId
	label.dataset.visible = "false"
	label.setAttribute("aria-hidden", "true")
	return label
}

/**
 * Puts the belt's name beside the canvas with its text; returns the clean-up, which removes
 * it only while it is still attached (the canvas's host may be gone when the page is left).
 */
export function attachBeltLabel(
	label: HTMLSpanElement,
	canvas: HTMLCanvasElement,
	text: string,
): () => void {
	label.textContent = text
	canvas.parentElement?.appendChild(label)
	return () => {
		label.parentNode?.removeChild(label)
	}
}

/**
 * Per frame: the belt shader's uniforms, and its name on the belt's middle circle on the
 * viewer's left, shown only while that circle is a sensible size on screen.
 */
export function updateBeltField(
	points: Points,
	label: HTMLSpanElement | null,
	frame: SimFrame,
	root: number,
	midKm: number,
	camera: Camera,
	pixelRatio: number,
	size: { width: number; height: number },
): void {
	updateBeltUniforms(
		(points.material as ShaderMaterial).uniforms as unknown as BeltUniforms,
		frame,
		root,
		pixelRatio,
	)
	if (label === null) return
	side.setFromMatrixColumn(camera.matrixWorld, 0).negate()
	beltLabelPosition(frame, midKm, side.x, side.z, labelAt)
	frame.renderPosition(root, centre)
	const distance = camera.position.distanceTo(centre)
	const pxPerUnit =
		camera instanceof PerspectiveCamera
			? pixelsPerUnitAtDistanceOne(camera, size.height)
			: 0
	const radiusPx =
		distance > 0 ? (labelAt.distanceTo(centre) * pxPerUnit) / distance : 0
	projected.copy(labelAt).project(camera)
	const inFront = projected.z > -1 && projected.z < 1
	const shown =
		inFront &&
		radiusPx >= BELT_LABEL_MIN_PX &&
		radiusPx <= BELT_LABEL_MAX_VIEWPORTS * size.height
	label.dataset.visible = shown ? "true" : "false"
	if (!shown) return
	const x = ((projected.x + 1) / 2) * size.width
	const y = ((1 - projected.y) / 2) * size.height
	label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
}

function BeltField({ belt }: { belt: Belt }) {
	const frame = useSimFrame()
	const { t } = useI18n()
	const points = useMemo(() => createBeltPoints(belt), [belt])
	const root = useMemo(() => rootIndexOf(frame.bodies), [frame])
	const midKm = useMemo(() => beltMidRadiusKm(belt), [belt])
	const size = useThree((state) => state.size)
	const gl = useThree((state) => state.gl)
	const text = t("solarSystem.smallBodies.beltName", { belt: belt.id })
	const label = useMemo(() => createBeltLabel(belt.id), [belt.id])

	useEffect(
		() => attachBeltLabel(label, gl.domElement, text),
		[label, gl, text],
	)

	useEffect(
		() => () => {
			points.geometry.dispose()
			;(points.material as ShaderMaterial).dispose()
		},
		[points],
	)

	useFrame(({ camera }) =>
		updateBeltField(
			points,
			label,
			frame,
			root,
			midKm,
			camera,
			gl.getPixelRatio(),
			size,
		),
	)

	return <primitive object={points} />
}

/** The belts, while the "Small bodies" layer is on. */
function Belts() {
	const show = useSimStore((state) => state.showSmallBodies)
	if (!show) return null
	return (
		<>
			{belts.map((belt) => (
				<BeltField key={belt.id} belt={belt} />
			))}
		</>
	)
}

export default Belts
