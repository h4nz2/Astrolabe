/**
 * Axial rotation (spin) of a body: where its axis points and how far it has turned.
 *
 * Conventions (see docs/ARCHITECTURE.md, "Simulation"):
 * - `spinAxis()` is the unit vector of the body's IAU north pole in the scene frame. The
 *   renderer aligns the mesh's local +Y with it, so planetary maps (north up) stay upright.
 *   Bodies with an IAU pole (`poleRaDeg`/`poleDecDeg`: the Sun, the planets, the Moon) use it;
 *   the others tilt their orbit normal by `axialTiltDeg` toward the ecliptic pole.
 * - `rotationAngle()` is a right-handed angle about that axis: positive = counterclockwise
 *   seen from the north pole = prograde. Its sign comes from `periodHours` alone (negative
 *   for Venus and Uranus); `axialTiltDeg` is always in [0, 90].
 * - The angle is measured from `equatorNode()`, the ascending node of the body's equator on
 *   the ICRF equator, where the IAU prime meridian angle W0 (`primeMeridianDeg`) is defined.
 */
import {
	degToRad,
	eclipticToScene,
	TWO_PI,
	type OrbitElements,
	type Vec3,
} from "./kepler"
import { HOURS_PER_DAY, J2000_JD } from "./time"

/** Mean obliquity of the ecliptic at J2000 (IAU 2006), degrees. */
export const OBLIQUITY_J2000_DEG = 23.4392911

/** The `Body["rotation"]` fields of bodies.json; every function here takes a subset. */
export interface RotationElements {
	/** Sidereal rotation period in hours; negative = retrograde; null = unknown (no spin). */
	readonly periodHours: number | null
	/** Obliquity to the body's own orbit, to the IAU north pole: 0..90 degrees. */
	readonly axialTiltDeg: number
	/** IAU north pole, ICRF right ascension in degrees (with poleDecDeg, or neither). */
	readonly poleRaDeg?: number
	/** IAU north pole, ICRF declination in degrees. */
	readonly poleDecDeg?: number
	/** IAU W0: prime meridian angle at J2000 in degrees, from equatorNode(). */
	readonly primeMeridianDeg?: number
}

/**
 * Unit vector, in the ECLIPTIC frame, of an ICRF/J2000 equatorial direction given by right
 * ascension and declination: (x, y cos e + z sin e, -y sin e + z cos e) with e the obliquity.
 */
export function eclipticDirection(
	raDeg: number,
	decDeg: number,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	const ra = degToRad(raDeg)
	const dec = degToRad(decDeg)
	const x = Math.cos(dec) * Math.cos(ra)
	const y = Math.cos(dec) * Math.sin(ra)
	const z = Math.sin(dec)
	const eps = degToRad(OBLIQUITY_J2000_DEG)
	const c = Math.cos(eps)
	const s = Math.sin(eps)
	out.x = x
	out.y = y * c + z * s
	out.z = -y * s + z * c
	return out
}

const hasPole = (
	rotation: Pick<RotationElements, "poleRaDeg" | "poleDecDeg">,
): rotation is { poleRaDeg: number; poleDecDeg: number } =>
	rotation.poleRaDeg !== undefined && rotation.poleDecDeg !== undefined

/**
 * Unit vector of the body's IAU north pole (spin axis) in the SCENE frame.
 *
 * With `poleRaDeg`/`poleDecDeg` the IAU pole is used. Otherwise the axis is the orbit normal
 * (the ecliptic pole when `orbit` is null) tilted by `axialTiltDeg` toward the ecliptic pole,
 * in the plane the two span: exact for tidally locked moons (tilt 0) and for the Moon's
 * Cassini state, where the spin axis lies 6.68 deg from the orbit normal on the far side of
 * the ecliptic pole. When the orbit normal is the ecliptic pole itself the axis leans toward
 * ecliptic longitude 90 (scene -Z), which is where the Earth's pole points.
 */
export function spinAxis(
	rotation: Pick<RotationElements, "axialTiltDeg" | "poleRaDeg" | "poleDecDeg">,
	orbit: OrbitElements | null,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	if (hasPole(rotation)) {
		eclipticDirection(rotation.poleRaDeg, rotation.poleDecDeg, out)
		return eclipticToScene(out, out)
	}
	// orbit normal h = (sin i sin Omega, -sin i cos Omega, cos i) in the ecliptic frame
	let nx = 0
	let ny = 0
	let nz = 1
	if (orbit !== null) {
		const inc = degToRad(orbit.inclinationDeg)
		const node = degToRad(orbit.longAscNodeDeg)
		nx = Math.sin(inc) * Math.sin(node)
		ny = -Math.sin(inc) * Math.cos(node)
		nz = Math.cos(inc)
	}
	// rotate n about k = n x z_ecl (unit, in the ecliptic plane) by the tilt: that moves
	// n toward the ecliptic pole. k x n is then the in-plane direction toward the pole.
	let kx = ny
	let ky = -nx
	const kLength = Math.hypot(kx, ky)
	if (kLength < 1e-9) {
		kx = -1
		ky = 0
	} else {
		kx /= kLength
		ky /= kLength
	}
	const tilt = degToRad(rotation.axialTiltDeg)
	const c = Math.cos(tilt)
	const s = Math.sin(tilt)
	const tx = ky * nz
	const ty = -kx * nz
	const tz = kx * ny - ky * nx
	out.x = nx * c + tx * s
	out.y = ny * c + ty * s
	out.z = nz * c + tz * s
	return eclipticToScene(out, out)
}

/**
 * Unit vector, SCENE frame, of the ascending node Q of the body's equator on the ICRF
 * equator: the IAU reference direction for the prime meridian angle W (`primeMeridianDeg`).
 * Q is at right ascension poleRaDeg + 90, declination 0, and is perpendicular to the pole.
 * Without an IAU pole it is the ascending node of the equator on the ecliptic
 * (ecliptic pole x spinAxis), or scene +X when the axis is the ecliptic pole.
 */
export function equatorNode(
	rotation: Pick<RotationElements, "axialTiltDeg" | "poleRaDeg" | "poleDecDeg">,
	orbit: OrbitElements | null,
	out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
	if (hasPole(rotation)) {
		eclipticDirection(rotation.poleRaDeg + 90, 0, out)
		return eclipticToScene(out, out)
	}
	spinAxis(rotation, orbit, out)
	// scene +Y (ecliptic pole) x axis = (axis.z, 0, -axis.x)
	const qx = out.z
	const qz = -out.x
	const length = Math.hypot(qx, qz)
	if (length < 1e-9) {
		out.x = 1
		out.y = 0
		out.z = 0
	} else {
		out.x = qx / length
		out.y = 0
		out.z = qz / length
	}
	return out
}

/**
 * Spin angle in radians at `jd`: W0 + 2 pi * (jd - epochJD) * 24 / periodHours, measured
 * from equatorNode() about spinAxis() (right handed).
 *
 * Not wrapped: it grows without bound so that consecutive frames never jump
 * (wrap with wrapAngle() from kepler.ts if a value in [0, 2pi) is needed).
 * Returns 0 when the period is null, zero or not finite (no spin, W0 ignored).
 */
export function rotationAngle(
	rotation: Pick<RotationElements, "periodHours" | "primeMeridianDeg">,
	jd: number,
	epochJD: number = J2000_JD,
): number {
	const period = rotation.periodHours
	if (period === null || period === 0 || !Number.isFinite(period)) return 0
	const w0 = degToRad(rotation.primeMeridianDeg ?? 0)
	return w0 + (TWO_PI * (jd - epochJD) * HOURS_PER_DAY) / period
}
