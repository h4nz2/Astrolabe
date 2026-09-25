/**
 * Where the sky is worked out for (#36): a city from the list, or the
 * device's own location, which is only ever asked for after an explicit tap
 * and an explanation (see src/store/skyTonight.ts for the privacy rules).
 */
import { roundCoordinate, type SkyPlaceChoice } from "@/store/skyTonight"

import { cityById, nearestCity, suggestedCity, type City } from "./places"
import type { SkyPlace } from "./sky"

/** The device's time zone, as the browser reports it to every page (no permission involved). */
export function deviceTimeZone(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone
	} catch {
		return undefined
	}
}

/** The city suggested before anyone chose one (from the time zone, else the language's region). */
export const suggestion = (): City =>
	suggestedCity(
		deviceTimeZone(),
		typeof navigator === "undefined" ? [] : navigator.languages,
	)

/** The observing place of a choice; null for an unknown city id. */
export function placeOf(choice: SkyPlaceChoice): SkyPlace | null {
	if (choice.kind === "device") return choice
	const city = cityById.get(choice.cityId)
	return city === undefined ? null : city
}

/** The city a device location is near (to name it), if one of the list is within 150 km. */
export const cityNear = (choice: SkyPlaceChoice): City | null =>
	choice.kind === "city"
		? (cityById.get(choice.cityId) ?? null)
		: nearestCity(choice.latitude, choice.longitude)

export type LocateResult =
	| { ok: true; choice: SkyPlaceChoice }
	| { ok: false; reason: "denied" | "failed" }

/**
 * Asks the browser for the device's location (it shows its own permission
 * prompt). Low accuracy is plenty and is kinder: no GPS fix is needed. The
 * position is rounded to 0.1 deg straight away.
 */
export function locateDevice(
	geolocation: Geolocation | undefined = typeof navigator === "undefined"
		? undefined
		: navigator.geolocation,
): Promise<LocateResult> {
	return new Promise((resolve) => {
		if (geolocation === undefined) {
			resolve({ ok: false, reason: "failed" })
			return
		}
		geolocation.getCurrentPosition(
			(position) =>
				resolve({
					ok: true,
					choice: {
						kind: "device",
						latitude: roundCoordinate(position.coords.latitude),
						longitude: roundCoordinate(position.coords.longitude),
						timeZone: deviceTimeZone() ?? "UTC",
					},
				}),
			(error) =>
				resolve({
					ok: false,
					reason: error.code === error.PERMISSION_DENIED ? "denied" : "failed",
				}),
			{ enableHighAccuracy: false, maximumAge: 10 * 60_000, timeout: 20_000 },
		)
	})
}
