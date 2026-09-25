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
import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import {
	BufferAttribute,
	BufferGeometry,
	Group,
	NormalBlending,
	Points,
	ShaderMaterial,
	Vector3,
} from "three"

import { belts, bodyById, type Belt } from "@/data"
import { useI18n } from "@/i18n"
import { rootIndexOf } from "@/sim"
import { generateBeltOrbits } from "@/sim/belts"
import { useSimStore } from "@/store/sim"

import { pixelsPerUnitAtDistanceOne } from "../scene/picking"
import { FRAME_BLEND_SLOTS, useSimFrame } from "../scene/simFrame"
import { beltFragmentShader, beltVertexShader } from "./beltShader"
import {
	beltLabelPosition,
	beltMidRadiusKm,
	createBeltUniforms,
	hexToRgb,
	updateBeltUniforms,
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

function BeltField({ belt }: { belt: Belt }) {
	const frame = useSimFrame()
	const { t } = useI18n()
	const points = useMemo(() => createBeltPoints(belt), [belt])
	const labelRef = useRef<Group>(null)
	const labelTextRef = useRef<HTMLSpanElement>(null)
	const root = useMemo(() => rootIndexOf(frame.bodies), [frame])
	const midKm = useMemo(() => beltMidRadiusKm(belt), [belt])
	const heightPx = useThree((state) => state.size.height)

	useEffect(
		() => () => {
			points.geometry.dispose()
			;(points.material as ShaderMaterial).dispose()
		},
		[points],
	)

	useFrame(({ camera, gl }) => {
		const material = points.material as ShaderMaterial
		updateBeltUniforms(
			material.uniforms as unknown as Parameters<typeof updateBeltUniforms>[0],
			frame,
			root,
			gl.getPixelRatio(),
		)
		// the name: on the belt's middle circle, on the viewer's left
		const label = labelRef.current
		const text = labelTextRef.current
		if (label === null || text === null) return
		side.setFromMatrixColumn(camera.matrixWorld, 0).negate()
		beltLabelPosition(frame, midKm, side.x, side.z, labelAt)
		label.position.copy(labelAt)
		frame.renderPosition(root, centre)
		const distance = camera.position.distanceTo(centre)
		const radiusUnits = labelAt.distanceTo(centre)
		const pxPerUnit =
			"fov" in camera
				? pixelsPerUnitAtDistanceOne(
						camera as Parameters<typeof pixelsPerUnitAtDistanceOne>[0],
						heightPx,
					)
				: 0
		const radiusPx = distance > 0 ? (radiusUnits * pxPerUnit) / distance : 0
		const shown =
			radiusPx >= BELT_LABEL_MIN_PX &&
			radiusPx <= BELT_LABEL_MAX_VIEWPORTS * heightPx
		text.dataset.visible = shown ? "true" : "false"
	})

	return (
		<>
			<primitive object={points} />
			<group ref={labelRef}>
				<Html
					className={classes.beltLabelAnchor}
					zIndexRange={[5, 0]}
					style={{ pointerEvents: "none" }}
				>
					<span
						ref={labelTextRef}
						className={classes.beltLabel}
						data-belt={belt.id}
						data-visible="false"
						aria-hidden
					>
						{t("solarSystem.smallBodies.beltName", { belt: belt.id })}
					</span>
				</Html>
			</group>
		</>
	)
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
