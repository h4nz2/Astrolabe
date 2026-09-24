/**
 * Pure simulation code: units, time, the simulation clock, Kepler propagation,
 * hierarchy positions, axial rotation. No React, no three.js. See docs/ARCHITECTURE.md.
 */
export {
	AU_KM,
	KM_PER_UNIT,
	SECONDS_PER_DAY,
	auToKm,
	kmToAu,
	toKm,
	toUnits,
} from "./units"
export {
	HOURS_PER_DAY,
	J2000_JD,
	MS_PER_DAY,
	UNIX_EPOCH_JD,
	dateToJD,
	daysBetween,
	jdToDate,
	secondsToDays,
} from "./time"
export {
	DEG_TO_RAD,
	KEPLER_MAX_ITERATIONS,
	KEPLER_TOLERANCE,
	RAD_TO_DEG,
	TWO_PI,
	degToRad,
	eclipticPositionAtEccentricAnomaly,
	eclipticToScene,
	meanAnomalyAt,
	orbitalPeriodToMeanMotion,
	positionAtEccentricAnomaly,
	propagate,
	propagateEcliptic,
	radToDeg,
	radius,
	sceneToEcliptic,
	solveEccentricAnomaly,
	trueAnomaly,
	wrapAngle,
} from "./kepler"
export type { OrbitElements, Vec3 } from "./kepler"
export {
	buildIndex,
	computePositions,
	relativePosition,
	relativeToOrigin,
} from "./positions"
export type { OrbitingBody, WritableVec3 } from "./positions"
export {
	DEFAULT_SCALE_PRESET,
	SCALE_PRESETS,
	SCALE_PRESET_IDS,
	TRUE_SCALE,
	childDistanceCurve,
	computeDisplayPositions,
	computeDisplayRadii,
	displayBodyLengthKm,
	displayDistanceKm,
	displayOffset,
	displayRadiusKm,
	distanceFactor,
	interpolateScale,
	isIdentityCurve,
	isScalePresetId,
	isTrueScale,
	isValidScale,
	mapDistance,
	presetOf,
	rootIndexOf,
	sameScale,
	sizeExaggeration,
} from "./scale"
export type {
	DistanceCurve,
	ScalableBody,
	ScaleFactor,
	ScalePresetId,
	ScaleSettings,
	SizeCurve,
} from "./scale"
export {
	OBLIQUITY_J2000_DEG,
	eclipticDirection,
	equatorNode,
	rotationAngle,
	spinAxis,
} from "./rotation"
export type { RotationElements } from "./rotation"
export {
	GLIDE_MAX_MS,
	GLIDE_MIN_MS,
	INSTANT_JUMP_DAYS,
	MAX_FRAME_GAP_MS,
	createTimeline,
	easeInOutSine,
	glideDurationMs,
	glideTimeline,
	isGliding,
	jumpTimeline,
	retimeTimeline,
	settleTimeline,
	skipFrameGap,
	timelineJD,
} from "./clock"
export type { SimTimeline, TimeGlide } from "./clock"
export { SCALE_LIES, bodyDistortion, presetForLies } from "./scaleLies"
export type {
	BodyDistortion,
	DistanceLie,
	ScaleLies,
	SizeLie,
} from "./scaleLies"
