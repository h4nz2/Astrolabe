/**
 * astronomy-engine (VSOP87-based) reference positions shared by the tests in src/sim and
 * src/data. Not part of the app: astronomy-engine is a devDependency and only test files
 * import this module.
 */
import {
	HelioVector,
	RotateVector,
	Rotation_EQJ_ECL,
	type Body,
} from "astronomy-engine"

import { radToDeg, type Vec3 } from "../kepler"
import { jdToDate } from "../time"
import { auToKm } from "../units"

const EQJ_TO_ECL = Rotation_EQJ_ECL()

/**
 * Heliocentric position in km, J2000 ecliptic frame. HelioVector() returns J2000
 * equatorial (EQJ) coordinates in AU; Rotation_EQJ_ECL turns them into the J2000 ecliptic
 * (Astronomy.Ecliptic() would give the ecliptic of date instead, which is not the frame of
 * the orbital elements).
 */
export function ephemerisEclipticKm(body: Body, jd: number): Vec3 {
	const ecl = RotateVector(EQJ_TO_ECL, HelioVector(body, jdToDate(jd)))
	return { x: auToKm(ecl.x), y: auToKm(ecl.y), z: auToKm(ecl.z) }
}

/** Angle between two vectors in degrees (atan2 form: exact for tiny and for obtuse angles). */
export function separationDeg(a: Vec3, b: Vec3): number {
	const dot = a.x * b.x + a.y * b.y + a.z * b.z
	const cx = a.y * b.z - a.z * b.y
	const cy = a.z * b.x - a.x * b.z
	const cz = a.x * b.y - a.y * b.x
	return radToDeg(Math.atan2(Math.hypot(cx, cy, cz), dot))
}

export const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z)
