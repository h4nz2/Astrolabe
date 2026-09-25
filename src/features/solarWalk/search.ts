/**
 * Search params of `/solar_walk?sun=orange&landmark=track&view=table` (#25).
 *
 * Kept free of app imports (only zod) because the route module that validates
 * the URL is loaded eagerly with the route tree; the walk and the body data
 * stay in the page's code-split chunk. Defaults are left out of the URL and
 * unknown values fall back to them.
 */
import { z } from "zod"

/** The objects the Sun can be, smallest first (sizes in walk.ts). */
export const SUN_OBJECT_IDS = [
	"orange",
	"football",
	"basketball",
	"exerciseBall",
] as const
export type SunObjectId = (typeof SUN_OBJECT_IDS)[number]
export const DEFAULT_SUN_OBJECT: SunObjectId = "basketball"

/** Real ground to measure the walk against (lengths in walk.ts). */
export const LANDMARK_IDS = ["pitch", "track"] as const
export type LandmarkId = (typeof LANDMARK_IDS)[number]
/** What the landmark picker offers: a landmark, or metres alone. */
export const LANDMARK_OPTIONS = ["none", ...LANDMARK_IDS] as const
export type LandmarkOption = (typeof LANDMARK_OPTIONS)[number]
export const DEFAULT_LANDMARK: LandmarkOption = "pitch"

/** The walk (the experience) or the table (to project or print). */
export const WALK_VIEWS = ["walk", "table"] as const
export type WalkView = (typeof WALK_VIEWS)[number]
export const DEFAULT_WALK_VIEW: WalkView = "walk"

export const solarWalkSearchSchema = z.object({
	sun: z.enum(SUN_OBJECT_IDS).optional().catch(undefined),
	landmark: z.enum(LANDMARK_OPTIONS).optional().catch(undefined),
	view: z.enum(WALK_VIEWS).optional().catch(undefined),
})

export type SolarWalkSearch = z.output<typeof solarWalkSearchSchema>
