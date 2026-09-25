/**
 * "What is in the sky tonight" (issue #36): whether the panel is open and the
 * place the sky is worked out for.
 *
 * Privacy is the point of this store's shape, because children use the app:
 * it lives in memory only. The place is never persisted (no localStorage, no
 * cookie), never written to the URL and never sent anywhere (everything is
 * computed on the device). Nothing is chosen for the visitor: until a place
 * is picked the panel asks. A device location is only asked for after an
 * explicit tap and an explanation, and is rounded to 0.1 deg (about 10 km)
 * before it is kept. Closing or reloading the page forgets it.
 */
import { create } from "zustand"

export type SkyPlaceChoice =
	| { readonly kind: "city"; readonly cityId: string }
	| {
			readonly kind: "device"
			/** Rounded to 0.1 degrees (`roundCoordinate`). */
			readonly latitude: number
			readonly longitude: number
			/** The device's own time zone: the times are shown in it. */
			readonly timeZone: string
	  }

export interface SkyTonightState {
	/** The panel is showing. */
	open: boolean
	/** The place chosen in this visit, or none yet (the panel then asks). */
	place: SkyPlaceChoice | null
	setOpen: (open: boolean) => void
	choosePlace: (place: SkyPlaceChoice) => void
	/** Back to the question: the place is dropped. */
	forgetPlace: () => void
}

/** Coordinates are kept to 0.1 degrees: about 10 km, plenty for the sky and no street address. */
export const roundCoordinate = (degrees: number): number =>
	Math.round(degrees * 10) / 10

export const useSkyTonightStore = create<SkyTonightState>()((set) => ({
	open: false,
	place: null,
	setOpen: (open) => set({ open }),
	choosePlace: (place) => {
		if (place.kind === "device") {
			if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude))
				return
			set({
				place: {
					...place,
					latitude: roundCoordinate(place.latitude),
					longitude: roundCoordinate(place.longitude),
				},
			})
			return
		}
		set({ place })
	},
	forgetPlace: () => set({ place: null }),
}))
