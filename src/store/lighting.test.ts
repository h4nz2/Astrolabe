import { describe, expect, it } from "vitest"

import { useLightingStore } from "./lighting"

describe("useLightingStore", () => {
	it("is honest by default and switches to always lit and back", () => {
		expect(useLightingStore.getState().alwaysLit).toBe(false)
		useLightingStore.getState().setAlwaysLit(true)
		expect(useLightingStore.getState().alwaysLit).toBe(true)
		useLightingStore.getState().setAlwaysLit(false)
		expect(useLightingStore.getState().alwaysLit).toBe(false)
	})
})
