/**
 * Re-referencing orbital elements from a planet's equatorial plane to the ecliptic.
 *
 * The satellite elements in data/ourDB.json (JPL) give the inclination to the moon's Laplace
 * plane, which for regular moons is the planet's equator. The build rotates such elements into
 * the ecliptic frame the simulation uses, so bodies.json carries one reference plane only.
 *
 * Frames are right handed. The equatorial frame of a planet whose north pole (unit vector,
 * ecliptic coordinates) is `p` has x along the ascending node of the equator on the ecliptic
 * (z_ecl x p), z along `p` and y = z x x. All matrices are row-major 3x3 arrays acting on
 * column vectors.
 */
import type { Vec3 } from "../../src/sim/kepler"
import { degToRad, radToDeg } from "../../src/sim/kepler"

export type Mat3 = readonly [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
]

/** The three angles that fix an orbit's plane and the direction of its periapsis. */
export interface PlaneElements {
	readonly inclinationDeg: number
	readonly longAscNodeDeg: number
	readonly argPeriapsisDeg: number
}

/** Active rotation about x by `rad` (R1). */
export const rotX = (rad: number): Mat3 => {
	const c = Math.cos(rad)
	const s = Math.sin(rad)
	return [1, 0, 0, 0, c, -s, 0, s, c]
}

/** Active rotation about z by `rad` (R3). */
export const rotZ = (rad: number): Mat3 => {
	const c = Math.cos(rad)
	const s = Math.sin(rad)
	return [c, -s, 0, s, c, 0, 0, 0, 1]
}

export const multiply = (a: Mat3, b: Mat3): Mat3 => {
	const out: number[] = new Array<number>(9).fill(0)
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			out[row * 3 + col] =
				a[row * 3] * b[col] +
				a[row * 3 + 1] * b[3 + col] +
				a[row * 3 + 2] * b[6 + col]
		}
	}
	return out as unknown as Mat3
}

export const apply = (m: Mat3, v: Vec3): Vec3 => ({
	x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
	y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
	z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
})

/** Column `index` (0..2) of `m`. */
const column = (m: Mat3, index: number): Vec3 => ({
	x: m[index],
	y: m[3 + index],
	z: m[6 + index],
})

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

const cross = (a: Vec3, b: Vec3): Vec3 => ({
	x: a.y * b.z - a.z * b.y,
	y: a.z * b.x - a.x * b.z,
	z: a.x * b.y - a.y * b.x,
})

const normalize = (v: Vec3): Vec3 => {
	const length = Math.hypot(v.x, v.y, v.z)
	return { x: v.x / length, y: v.y / length, z: v.z / length }
}

const wrapDeg = (deg: number): number => ((deg % 360) + 360) % 360

/**
 * Perifocal -> reference frame rotation R3(Omega) R1(i) R3(omega): its columns are the
 * periapsis direction, the in-plane direction 90 deg ahead of it, and the orbit normal.
 * Matches eclipticPositionAtEccentricAnomaly() in src/sim/kepler.ts.
 */
export const orbitOrientation = (elements: PlaneElements): Mat3 =>
	multiply(
		rotZ(degToRad(elements.longAscNodeDeg)),
		multiply(
			rotX(degToRad(elements.inclinationDeg)),
			rotZ(degToRad(elements.argPeriapsisDeg)),
		),
	)

/**
 * Inverse of orbitOrientation(): i, Omega, omega in [0, 360) from a perifocal -> reference
 * rotation. For i = 0 the node is undefined and Omega is reported as 180 (atan2(0, -0)),
 * with omega measured from that direction, which propagates to the same positions.
 */
export const elementsFromOrientation = (m: Mat3): PlaneElements => {
	const periapsis = column(m, 0)
	const normal = column(m, 2)
	const inclination = Math.acos(Math.min(1, Math.max(-1, normal.z)))
	const node = Math.atan2(normal.x, -normal.y)
	const nodeDirection: Vec3 = { x: Math.cos(node), y: Math.sin(node), z: 0 }
	const argPeriapsis = Math.atan2(
		dot(cross(nodeDirection, periapsis), normal),
		dot(nodeDirection, periapsis),
	)
	return {
		inclinationDeg: radToDeg(inclination),
		longAscNodeDeg: wrapDeg(radToDeg(node)),
		argPeriapsisDeg: wrapDeg(radToDeg(argPeriapsis)),
	}
}

/**
 * Equatorial -> ecliptic rotation for a planet whose north pole is `poleEcliptic`
 * (unit vector in ecliptic coordinates). When the pole is the ecliptic pole itself the
 * node is undefined and the frames are taken to coincide.
 */
export const equatorToEcliptic = (poleEcliptic: Vec3): Mat3 => {
	const pole = normalize(poleEcliptic)
	const nodeRaw = cross({ x: 0, y: 0, z: 1 }, pole)
	const node =
		Math.hypot(nodeRaw.x, nodeRaw.y, nodeRaw.z) < 1e-9
			? { x: 1, y: 0, z: 0 }
			: normalize(nodeRaw)
	const y = cross(pole, node)
	return [node.x, y.x, pole.x, node.y, y.y, pole.y, node.z, y.z, pole.z]
}

/**
 * Elements given relative to a planet's equator, expressed relative to the ecliptic.
 * Semi-major axis, eccentricity and mean anomaly are frame independent and not touched.
 */
export const rotateElementsToEcliptic = (
	elements: PlaneElements,
	poleEcliptic: Vec3,
): PlaneElements =>
	elementsFromOrientation(
		multiply(equatorToEcliptic(poleEcliptic), orbitOrientation(elements)),
	)
