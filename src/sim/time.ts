/**
 * Julian Date helpers.
 *
 * Simulation time (`simTimeJD`) is a Julian Date: a double counting days since
 * noon on 1 January 4713 BC (proleptic Julian calendar). The conversions here
 * treat the UTC instant of a JS Date as the JD time scale; the roughly one
 * minute difference between UTC and Terrestrial Time is ignored, which is far
 * below anything a visualisation can show.
 *
 * Nothing in src/sim reads the wall clock. Callers convert `new Date()` with
 * dateToJD() themselves, so the simulation stays deterministic and testable.
 */
import { SECONDS_PER_DAY } from "./units"

/** Julian Date of the J2000.0 epoch, 2000-01-01T12:00:00 (TT). */
export const J2000_JD = 2451545.0

/** Julian Date of the Unix epoch, 1970-01-01T00:00:00Z. */
export const UNIX_EPOCH_JD = 2440587.5

/** Milliseconds in one day. */
export const MS_PER_DAY = SECONDS_PER_DAY * 1000

/** Hours in one day. */
export const HOURS_PER_DAY = 24

/**
 * Julian Date of a Date instant (UTC based).
 * Exact for whole milliseconds: dateToJD(2000-01-01T12:00:00Z) === J2000_JD.
 */
export function dateToJD(date: Date): number {
	return UNIX_EPOCH_JD + date.getTime() / MS_PER_DAY
}

/** Date instant of a Julian Date, rounded to the nearest millisecond. */
export function jdToDate(jd: number): Date {
	return new Date(Math.round((jd - UNIX_EPOCH_JD) * MS_PER_DAY))
}

/** Signed number of days from `fromJD` to `toJD` (negative when `toJD` is earlier). */
export function daysBetween(fromJD: number, toJD: number): number {
	return toJD - fromJD
}

/** Converts a duration in seconds to days, for advancing a JD by wall-clock time. */
export function secondsToDays(seconds: number): number {
	return seconds / SECONDS_PER_DAY
}
