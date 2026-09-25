/**
 * When a moon's surface map is fetched (#37, docs/ARCHITECTURE.md, "Moon surfaces"). Every
 * moon has its own map now, 183 of them, and most are specks most of the time: a map is only
 * worth its download once the moon is drawn wide enough for a pattern to show. Until then the
 * moon is drawn in its map's mean colour (`appearance.color`), which at that size is what the
 * map would look like anyway. Once fetched, a map stays.
 */

/** A moon's map is fetched once its drawn disc is at least this radius on screen (px). */
export const SURFACE_LOAD_PX = 4

/** Whether a sphere of `radiusUnits` at `distanceUnits` is wide enough on screen to fetch its map. */
export const wantsSurface = (
	radiusUnits: number,
	distanceUnits: number,
	pxPerUnit: number,
): boolean =>
	distanceUnits <= radiusUnits ||
	(radiusUnits * pxPerUnit) / distanceUnits >= SURFACE_LOAD_PX
