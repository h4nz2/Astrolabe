import { afterEach, describe, expect, it } from "vitest"

import { DEFAULT_WEIGHT_KG, hidesTimeInUrl, useBirthdayStore } from "./birthday"

afterEach(() => {
	useBirthdayStore.getState().forget()
	useBirthdayStore.getState().setOpen(false)
})

describe("useBirthdayStore", () => {
	it("holds the birth date in memory only and forgets it", () => {
		const store = useBirthdayStore.getState()
		expect(hidesTimeInUrl(useBirthdayStore.getState())).toBe(false)
		store.setBirthDay("2014-09-25")
		store.setWeightKg(55)
		expect(hidesTimeInUrl(useBirthdayStore.getState())).toBe(true)
		useBirthdayStore.getState().forget()
		expect(useBirthdayStore.getState().birthDay).toBeNull()
		expect(useBirthdayStore.getState().weightKg).toBe(DEFAULT_WEIGHT_KG)
		expect(hidesTimeInUrl(useBirthdayStore.getState())).toBe(false)
	})

	it("ignores weights that are not a positive number", () => {
		const store = useBirthdayStore.getState()
		store.setWeightKg(Number.NaN)
		store.setWeightKg(-3)
		store.setWeightKg(0)
		expect(useBirthdayStore.getState().weightKg).toBe(DEFAULT_WEIGHT_KG)
	})
})
