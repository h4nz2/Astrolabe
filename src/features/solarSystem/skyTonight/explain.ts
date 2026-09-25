/**
 * "Here is why you can see it tonight" (#36): the 3D view of the geometry
 * behind a sighting. Earth is held still (#31's anchored frame), so the Sun
 * and the planet are drawn at their TRUE directions from Earth in every scale
 * preset (#8: directions between bodies that are not parent and child must
 * come from true positions), seen from above the ecliptic at the moment the
 * list tells you to look, with the body selected. Everything goes through
 * the navigation model and the clock actions; nothing here touches the
 * camera or the clock directly.
 */
import { bodies, bodyById } from "@/data"
import { buildIndex, dateToJD } from "@/sim"
import { bodyPositionAt } from "@/sim/referenceFrame"
import { MAX_ELEVATION_DEG, type ViewRequest } from "@/store/navigation"
import { useSimStore } from "@/store/sim"
import { useTrailStore } from "@/store/trails"

import { travelAndStop } from "../ui/timeTravel"

const index = buildIndex(bodies)
const a = new Float64Array(3)
const b = new Float64Array(3)

const distanceKm = (from: string, to: string, jd: number): number => {
	const i = index.get(from)
	const j = index.get(to)
	if (i === undefined || j === undefined) return Number.NaN
	bodyPositionAt(bodies, index, i, jd, a)
	bodyPositionAt(bodies, index, j, jd, b)
	return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

const TOP_DOWN = { azimuthDeg: 0, elevationDeg: MAX_ELEVATION_DEG }

/**
 * The camera for `id` at `jd`: the Moon's orbit around Earth, or a region
 * around Earth wide enough for the Sun and the planet, from straight above,
 * with room to spare: the HUD panels at the sides cover the edges.
 */
export function whyRequest(id: string, jd: number): ViewRequest {
	if (id === "moon") {
		const moonOrbitKm = bodyById.get("moon")?.orbit?.semiMajorAxisKm ?? 384_400
		return { shot: TOP_DOWN, fit: { km: 1.4 * moonOrbitKm, around: "earth" } }
	}
	const km = Math.max(
		distanceKm("earth", "sun", jd),
		distanceKm("earth", id, jd),
	)
	return { shot: TOP_DOWN, fit: { km: 1.5 * km, around: "sun" } }
}

/** Holds Earth still at `ms` (epoch ms), seen from above, with `id` selected. */
export function showWhy(id: string, ms: number): void {
	if (!bodyById.has(id) || !Number.isFinite(ms)) return
	const jd = dateToJD(new Date(ms))
	const store = useSimStore.getState()
	useTrailStore.getState().clearRestart()
	store.anchorFrame("earth", whyRequest(id, jd))
	store.select(id)
	travelAndStop(jd)
}
