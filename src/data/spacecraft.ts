/**
 * Typed access to the spacecraft catalogue and trajectories (issue #35,
 * docs/ARCHITECTURE.md, "Spacecraft"). Both files are produced by
 * `pnpm build:spacecraft` (scripts/build-spacecraft.ts) from data/spacecraft.json
 * and NASA/JPL Horizons, validated there and again by
 * src/data/spacecraft.test.ts, so they are cast here.
 *
 * The catalogue (names, dates, events: a few kB) is bundled with the page.
 * The trajectories (about 0.5 MB) are a separate chunk, loaded on demand with
 * `loadTrajectoryData()`: the page does not wait for them, and a school
 * network downloads them once, after the scene is up.
 */
import type {
	Spacecraft,
	SpacecraftFile,
	TrajectoriesFile,
} from "./spacecraftSchema"

import spacecraftJson from "./spacecraft.json"

export type {
	Spacecraft,
	SpacecraftEnd,
	SpacecraftEvent,
	SpacecraftEventKind,
	SpacecraftFile,
	SpacecraftOrbit,
	TrajectoriesFile,
	TrajectorySegment,
} from "./spacecraftSchema"

const file = spacecraftJson as SpacecraftFile

/** Every craft, in catalogue order. */
export const spacecraft: readonly Spacecraft[] = file.craft

export const spacecraftById: ReadonlyMap<string, Spacecraft> = new Map(
	spacecraft.map((craft) => [craft.id, craft]),
)

/** Where the data comes from and how accurate it is. */
export const spacecraftSource = file.source

/** The day the catalogue was compiled: events after it are plans, positions after it predictions. */
export const spacecraftAsOf: string = file.asOf

let trajectoryData: Promise<TrajectoriesFile> | null = null

/** The trajectory segments of every craft, by id (fetched once, then cached). */
export function loadTrajectoryData(): Promise<TrajectoriesFile> {
	trajectoryData ??= import("./spacecraftTrajectories.json").then(
		(module) => module.default as TrajectoriesFile,
	)
	return trajectoryData
}
