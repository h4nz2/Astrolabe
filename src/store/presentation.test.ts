import { describe, expect, it } from "vitest"

import {
	presentationFromSearch,
	presentationSearch,
	samePresentationSearch,
	usePresentationStore,
} from "./presentation"
import { simSearchSchema } from "./simSearch"

describe("presentation URL params (#29)", () => {
	it("writes only what differs from the defaults", () => {
		expect(
			presentationSearch({
				presenting: false,
				highContrast: false,
				paused: false,
			}),
		).toEqual({ present: undefined, contrast: undefined, paused: undefined })
		expect(
			presentationSearch({
				presenting: true,
				highContrast: true,
				paused: true,
			}),
		).toEqual({ present: true, contrast: "high", paused: true })
	})

	it("round-trips through the search schema", () => {
		const search = simSearchSchema.parse({
			present: true,
			contrast: "high",
			paused: true,
		})
		expect(presentationFromSearch(search)).toEqual({
			presenting: true,
			highContrast: true,
		})
		expect(search.paused).toBe(true)
		expect(
			samePresentationSearch(
				search,
				presentationSearch({
					presenting: true,
					highContrast: true,
					paused: true,
				}),
			),
		).toBe(true)
	})

	it("drops invalid values instead of failing the page", () => {
		const search = simSearchSchema.parse({
			present: "yes",
			contrast: "extreme",
			paused: 3,
		})
		expect(search.present).toBeUndefined()
		expect(search.contrast).toBeUndefined()
		expect(search.paused).toBeUndefined()
		expect(presentationFromSearch(search)).toEqual({
			presenting: false,
			highContrast: false,
		})
	})

	it("tells apart any single difference", () => {
		const base = { present: true, contrast: "high", paused: true } as const
		expect(samePresentationSearch(base, { ...base, present: undefined })).toBe(
			false,
		)
		expect(samePresentationSearch(base, { ...base, contrast: undefined })).toBe(
			false,
		)
		expect(samePresentationSearch(base, { ...base, paused: undefined })).toBe(
			false,
		)
	})
})

describe("usePresentationStore", () => {
	it("numbers every announcement, so the same sentence is read out twice", () => {
		const { announce } = usePresentationStore.getState()
		announce("Now showing Mars")
		const first = usePresentationStore.getState().announcement
		announce("Now showing Mars")
		const second = usePresentationStore.getState().announcement
		expect(second?.text).toBe(first?.text)
		expect(second?.id).toBe((first?.id ?? 0) + 1)
	})
})
