/**
 * The side-by-side (#31): a small map of the same moment seen from above the
 * Sun, next to the anchored 3D view. It shows the observer's planet and the
 * target on their true orbits and the line of sight between them, so the
 * backwards loop in the 3D view can be read off as one planet overtaking the
 * other. Pure: SVG coordinates from TRUE positions, true proportions.
 *
 * Orientation matches the 3D view seen from straight above (azimuth 0): scene
 * +x to the right, scene +z (ecliptic south) down, so the SVG's (x, y) are
 * the scene's (x, z).
 */
import type { Body } from "@/data"
import { TWO_PI, positionAtEccentricAnomaly, type Vec3 } from "@/sim"
import { bodyPositionAt } from "@/sim/referenceFrame"

export interface InsetPoint {
	x: number
	y: number
}

export interface InsetGeometry {
	/** Half the size of the square; the Sun is at (0, 0). */
	radius: number
	/** One SVG path per orbit drawn (the observer's planet first). */
	orbits: string[]
	observer: InsetPoint
	target: InsetPoint
	/** From the observer, through the target, to the edge of the map. */
	sightEnd: InsetPoint
}

const ORBIT_POINTS = 72
const scratch: Vec3 = { x: 0, y: 0, z: 0 }
const at = new Float64Array(3)

const aphelion = (body: Body): number =>
	body.orbit === null
		? 0
		: body.orbit.semiMajorAxisKm * (1 + body.orbit.eccentricity)

function orbitPath(body: Body, scale: number): string {
	if (body.orbit === null) return ""
	const parts: string[] = []
	for (let k = 0; k < ORBIT_POINTS; k++) {
		positionAtEccentricAnomaly(body.orbit, (TWO_PI * k) / ORBIT_POINTS, scratch)
		parts.push(
			`${k === 0 ? "M" : "L"} ${(scratch.x * scale).toFixed(2)} ${(scratch.z * scale).toFixed(2)}`,
		)
	}
	return `${parts.join(" ")} Z`
}

/**
 * The map for `observer` and `target` (both top-level bodies or the root) at
 * `jd`, in a square of `2 * radius` with a margin of `margin`.
 */
export function insetGeometry(
	bodies: readonly Body[],
	index: ReadonlyMap<string, number>,
	observer: number,
	target: number,
	jd: number,
	radius: number,
	margin = 8,
): InsetGeometry {
	const extent = Math.max(aphelion(bodies[observer]), aphelion(bodies[target]))
	const scale = extent > 0 ? (radius - margin) / extent : 1
	const point = (i: number): InsetPoint => {
		bodyPositionAt(bodies, index, i, jd, at)
		return { x: at[0] * scale, y: at[2] * scale }
	}
	const o = point(observer)
	const t = point(target)
	// the ray o + s (t - o) meets the circle of the map's radius at s >= 1
	const dx = t.x - o.x
	const dy = t.y - o.y
	const a = dx * dx + dy * dy
	const b = 2 * (o.x * dx + o.y * dy)
	const c = o.x * o.x + o.y * o.y - radius * radius
	const disc = b * b - 4 * a * c
	const s = a > 0 && disc >= 0 ? (-b + Math.sqrt(disc)) / (2 * a) : 1
	return {
		radius,
		orbits: [bodies[observer], bodies[target]]
			.filter(
				(body, k, list) => body.orbit !== null && list.indexOf(body) === k,
			)
			.map((body) => orbitPath(body, scale)),
		observer: o,
		target: t,
		sightEnd: { x: o.x + dx * Math.max(1, s), y: o.y + dy * Math.max(1, s) },
	}
}
