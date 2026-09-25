/**
 * Where the camera is in the solar system, for the ambient bed (#32): a few
 * times a second, while the bed is audible, the camera's drawn distance from
 * the drawn Sun is turned into the TRUE distance it stands for
 * (`equivalentTrueKm`, read off the planets), so the bed means the same place
 * in every scale preset. Renders nothing and writes a plain module value,
 * never React state.
 */
import { useRef } from "react"
import { useFrame } from "@react-three/fiber"

import { KM_PER_UNIT } from "@/sim/units"
import { useSoundStore } from "@/store/sound"

import { useSimFrame, type SimFrame } from "../scene/simFrame"
import { equivalentTrueKm, kmToAu, type DistancePair } from "./mix"

/** The camera's distance from the Sun, AU (true-scale equivalent); 1 until measured. */
export const soundProbe = { au: 1 }

const PROBE_INTERVAL_S = 0.25

const pairs: DistancePair[] = []

const distance = (
	a: ArrayLike<number>,
	i: number,
	x: number,
	y: number,
	z: number,
): number => Math.hypot(a[i] - x, a[i + 1] - y, a[i + 2] - z)

/** Measures the camera at world display km (`cx`, `cy`, `cz`) into `soundProbe`. */
export function probeCamera(
	frame: SimFrame,
	cx: number,
	cy: number,
	cz: number,
): number {
	const sun = (frame.index.get("sun") ?? 0) * 3
	const [sx, sy, sz] = [
		frame.displayKm[sun],
		frame.displayKm[sun + 1],
		frame.displayKm[sun + 2],
	]
	const [tx, ty, tz] = [
		frame.positionsKm[sun],
		frame.positionsKm[sun + 1],
		frame.positionsKm[sun + 2],
	]
	pairs.length = 0
	frame.bodies.forEach((body, index) => {
		if (body.kind !== "planet") return
		pairs.push({
			display: distance(frame.displayKm, index * 3, sx, sy, sz),
			true: distance(frame.positionsKm, index * 3, tx, ty, tz),
		})
	})
	const displayKm = Math.hypot(cx - sx, cy - sy, cz - sz)
	soundProbe.au = kmToAu(equivalentTrueKm(displayKm, pairs))
	return soundProbe.au
}

function SoundProbe() {
	const frame = useSimFrame()
	const elapsed = useRef(PROBE_INTERVAL_S)

	useFrame(({ camera }, delta) => {
		elapsed.current += delta
		if (elapsed.current < PROBE_INTERVAL_S) return
		const { enabled, ambient } = useSoundStore.getState()
		if (!enabled || !ambient) return
		elapsed.current = 0
		const origin = frame.originKm
		probeCamera(
			frame,
			origin[0] + camera.position.x * KM_PER_UNIT,
			origin[1] + camera.position.y * KM_PER_UNIT,
			origin[2] + camera.position.z * KM_PER_UNIT,
		)
	})

	return null
}

export default SoundProbe
