import { afterEach, describe, expect, it } from "vitest"

import { AU_KM, dateToJD } from "@/sim"
import { useSimStore } from "@/store/sim"
import { useSkyTonightStore } from "@/store/skyTonight"
import { useTrailStore } from "@/store/trails"

import { showWhy, whyRequest } from "./explain"
import { locateDevice, placeOf } from "./location"

const store = () => useSimStore.getState()
afterEach(() => {
	useSimStore.setState(useSimStore.getInitialState(), true)
	useTrailStore.setState(useTrailStore.getInitialState(), true)
	useSkyTonightStore.setState(useSkyTonightStore.getInitialState(), true)
})

const MS = Date.parse("2026-09-25T22:00:00Z")

describe("Show me in space", () => {
	it("holds Earth still at the moment to look, from above, with the planet selected", () => {
		store().setPaused(false)
		useTrailStore.getState().restartTrails(2460000)
		showWhy("saturn", MS)
		expect(store().frameId).toBe("earth")
		expect(store().view).toEqual({ kind: "body", id: "earth" })
		expect(store().selectedId).toBe("saturn")
		expect(store().paused).toBe(true)
		expect(store().clock.glide).not.toBeNull()
		expect(store().clock.anchorJD).toBeCloseTo(dateToJD(new Date(MS)), 6)
		expect(store().transition?.shot?.elevationDeg).toBeGreaterThan(89)
		expect(useTrailStore.getState().sinceJD).toBeNull()
	})

	it("frames the Sun and the planet around Earth, or the Moon's orbit", () => {
		const jd = dateToJD(new Date(MS))
		const saturn = whyRequest("saturn", jd)
		expect(saturn.fit?.around).toBe("sun")
		// Saturn at opposition is about 8.4 AU from Earth
		expect((saturn.fit?.km ?? 0) / AU_KM).toBeGreaterThan(8.4 * 1.4)
		expect((saturn.fit?.km ?? 0) / AU_KM).toBeLessThan(8.4 * 1.6)
		const venus = whyRequest("venus", jd)
		// Venus is closer than the Sun: the frame fits the Sun
		expect((venus.fit?.km ?? 0) / AU_KM).toBeCloseTo(1.5, 1)
		const moon = whyRequest("moon", jd)
		expect(moon.fit?.around).toBe("earth")
		expect(moon.fit?.km).toBeLessThan(1e6)
	})

	it("ignores unknown bodies and broken times", () => {
		showWhy("vulcan", MS)
		showWhy("mars", Number.NaN)
		expect(store().frameId).toBe("sun")
	})
})

describe("the place", () => {
	it("keeps a device location only to 0.1 degrees, in memory", () => {
		useSkyTonightStore.getState().choosePlace({
			kind: "device",
			latitude: 47.376_887,
			longitude: 8.541_694,
			timeZone: "Europe/Zurich",
		})
		expect(useSkyTonightStore.getState().place).toEqual({
			kind: "device",
			latitude: 47.4,
			longitude: 8.5,
			timeZone: "Europe/Zurich",
		})
		useSkyTonightStore.getState().forgetPlace()
		expect(useSkyTonightStore.getState().place).toBeNull()
	})

	it("ignores a broken device location", () => {
		useSkyTonightStore.getState().choosePlace({
			kind: "device",
			latitude: Number.NaN,
			longitude: 8,
			timeZone: "UTC",
		})
		expect(useSkyTonightStore.getState().place).toBeNull()
	})

	it("turns a city into an observing place", () => {
		expect(placeOf({ kind: "city", cityId: "bern" })).toMatchObject({
			latitude: 46.95,
			timeZone: "Europe/Zurich",
		})
		expect(placeOf({ kind: "city", cityId: "atlantis" })).toBeNull()
	})

	it("asks the browser with low accuracy and rounds what it gets", async () => {
		let options: PositionOptions | undefined
		const granted = {
			getCurrentPosition: (
				ok: PositionCallback,
				_fail: PositionErrorCallback | null | undefined,
				opts?: PositionOptions,
			) => {
				options = opts
				ok({
					coords: { latitude: -33.8688, longitude: 151.2093 },
				} as GeolocationPosition)
			},
		} as unknown as Geolocation
		const result = await locateDevice(granted)
		expect(options?.enableHighAccuracy).toBe(false)
		expect(result).toMatchObject({
			ok: true,
			choice: { kind: "device", latitude: -33.9, longitude: 151.2 },
		})
	})

	it("reports a refusal, so the panel can offer the city list", async () => {
		const denied = {
			getCurrentPosition: (
				_ok: PositionCallback,
				fail: PositionErrorCallback,
			) => fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
		} as unknown as Geolocation
		expect(await locateDevice(denied)).toEqual({ ok: false, reason: "denied" })
		expect(await locateDevice(undefined)).toEqual({
			ok: false,
			reason: "failed",
		})
	})
})
