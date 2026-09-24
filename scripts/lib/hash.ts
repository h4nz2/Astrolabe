/**
 * Deterministic phase spreading for moons whose source elements have no phase
 * information (longAscNode, argPeriapsis and mainAnomaly all 0). A stable string
 * hash of the body id keeps the result identical across builds and machines.
 */

/** 32-bit FNV-1a hash of a string (UTF-16 code units). */
export const fnv1a32 = (input: string): number => {
	let hash = 0x811c9dc5
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

/** Maps a string to an angle in [0, 360) with three decimals. */
export const hashToDegrees = (input: string): number => {
	const degrees = (fnv1a32(input) / 0x100000000) * 360
	return Math.round(degrees * 1000) / 1000
}

export interface SyntheticPhases {
	meanAnomalyDeg: number
	argPeriapsisDeg: number
	longAscNodeDeg: number
}

/** Three independent angles in [0, 360) derived from the body id. */
export const spreadPhases = (id: string): SyntheticPhases => ({
	meanAnomalyDeg: hashToDegrees(`${id}:meanAnomaly`),
	argPeriapsisDeg: hashToDegrees(`${id}:argPeriapsis`),
	longAscNodeDeg: hashToDegrees(`${id}:longAscNode`),
})
