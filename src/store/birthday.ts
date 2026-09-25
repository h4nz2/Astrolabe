/**
 * "Your birthday in space" (issue #26): the birth date a visitor entered, the
 * weight the weight comparison starts from and whether the panel is open.
 *
 * Privacy is the point of this store's shape: it lives in memory only. Nothing
 * here is persisted (no localStorage, no cookie), sent anywhere or written to
 * the URL, and while a birth date is entered the simulation time is kept out
 * of the URL as well (`hidesTimeInUrl`, read by `urlSync.ts`), because after
 * "show me the planets on my birthday" the clock itself IS the birth date.
 * Closing or reloading the page forgets everything.
 */
import { create } from "zustand"

/** The weight (kg on Earth) the weight comparison starts at: the issue's "40 kg student". */
export const DEFAULT_WEIGHT_KG = 40

export interface BirthdayState {
	/** The day of birth, "YYYY-MM-DD" (a calendar day, no time zone), or none entered. */
	birthDay: string | null
	/** What the visitor weighs on Earth, in kg (chosen with a slider, never typed). */
	weightKg: number
	/** The birthday panel is showing. */
	open: boolean
	setBirthDay: (day: string) => void
	setWeightKg: (kg: number) => void
	setOpen: (open: boolean) => void
	/** Drops the birth date and the weight: back to the start, nothing kept. */
	forget: () => void
}

export const useBirthdayStore = create<BirthdayState>()((set) => ({
	birthDay: null,
	weightKg: DEFAULT_WEIGHT_KG,
	open: false,
	setBirthDay: (birthDay) => set({ birthDay }),
	setWeightKg: (weightKg) => {
		if (Number.isFinite(weightKg) && weightKg > 0) set({ weightKg })
	},
	setOpen: (open) => set({ open }),
	forget: () => set({ birthDay: null, weightKg: DEFAULT_WEIGHT_KG }),
}))

/** While a birth date is entered, the simulation time never goes into a link. */
export const hidesTimeInUrl = (state: Pick<BirthdayState, "birthDay">) =>
	state.birthDay !== null
