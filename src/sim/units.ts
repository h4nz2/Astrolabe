/**
 * Scale and unit constants shared by the simulation and the renderer.
 *
 * The scene is true scale: one three.js unit is 1000 km. Nothing outside this
 * module may hard-code that factor; go through toUnits() / toKm() instead.
 */

/** Kilometres per scene (three.js) unit. */
export const KM_PER_UNIT = 1000

/** One astronomical unit in kilometres (IAU 2012 definition). */
export const AU_KM = 149597870.7

/** Seconds in one day (the day unit of Julian Dates). */
export const SECONDS_PER_DAY = 86400

/** Converts a length in kilometres to scene units. */
export const toUnits = (km: number): number => km / KM_PER_UNIT

/** Converts a length in scene units to kilometres. */
export const toKm = (units: number): number => units * KM_PER_UNIT

/** Converts astronomical units to kilometres. */
export const auToKm = (au: number): number => au * AU_KM

/** Converts kilometres to astronomical units. */
export const kmToAu = (km: number): number => km / AU_KM
