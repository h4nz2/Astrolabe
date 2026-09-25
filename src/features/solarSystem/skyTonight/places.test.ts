import { describe, expect, it } from "vitest"

import {
	CITIES,
	cityById,
	cityName,
	citiesOf,
	countries,
	countryName,
	nearestCity,
	suggestedCity,
} from "./places"

describe("the city list", () => {
	it("has unique ids, real coordinates and time zones the platform knows", () => {
		expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length)
		for (const city of CITIES) {
			expect(Math.abs(city.latitude), city.id).toBeLessThanOrEqual(90)
			expect(Math.abs(city.longitude), city.id).toBeLessThanOrEqual(180)
			expect(city.country, city.id).toMatch(/^[A-Z]{2}$/)
			expect(
				() => new Intl.DateTimeFormat("en", { timeZone: city.timeZone }),
				city.id,
			).not.toThrow()
		}
	})

	it("covers Switzerland, Germany and Austria well, and every continent", () => {
		for (const country of ["CH", "DE", "AT"]) {
			expect(citiesOf(country, "en").length).toBeGreaterThanOrEqual(6)
		}
		const south = CITIES.filter((c) => c.latitude < 0)
		expect(south.length).toBeGreaterThan(20)
		expect(countries("en").length).toBeGreaterThan(100)
	})

	it("names countries through Intl and cities in German where German has its own name", () => {
		expect(countryName("CH", "de")).toBe("Schweiz")
		expect(countryName("CH", "en")).toBe("Switzerland")
		const munich = cityById.get("munich")
		expect(munich && cityName(munich, "de-CH")).toBe("München")
		expect(munich && cityName(munich, "en")).toBe("Munich")
		const german = countries("de").map((c) => c.name)
		expect(german).toContain("Österreich")
		// sorted for the reader's language
		expect(german.indexOf("Österreich")).toBeLessThan(german.indexOf("Polen"))
	})
})

describe("the suggested place", () => {
	it("is the time zone's own city", () => {
		expect(suggestedCity("Europe/Zurich").id).toBe("zurich")
		expect(suggestedCity("Europe/Berlin").id).toBe("berlin")
		expect(suggestedCity("America/New_York").id).toBe("new-york")
		expect(suggestedCity("America/Argentina/Buenos_Aires").id).toBe(
			"buenos-aires",
		)
	})

	it("understands old zone names and zones without a namesake", () => {
		expect(suggestedCity("Asia/Calcutta").id).toBe("kolkata")
		expect(suggestedCity("Europe/Kiev").id).toBe("kyiv")
		expect(suggestedCity("Asia/Shanghai").id).toBe("shanghai")
		expect(suggestedCity("Europe/Busingen").id).toBe("zurich")
	})

	it("falls back to the language's region, then to London", () => {
		expect(suggestedCity("Etc/UTC", ["de-CH", "de"]).country).toBe("CH")
		expect(suggestedCity(undefined, ["de-AT"]).country).toBe("AT")
		expect(suggestedCity("Etc/UTC", []).id).toBe("london")
		expect(suggestedCity(undefined, ["not a tag"]).id).toBe("london")
	})
})

describe("the nearest city", () => {
	it("names a device location by a city of the list nearby", () => {
		expect(nearestCity(47.4, 8.5)?.id).toBe("zurich")
		expect(nearestCity(-33.9, 151.2)?.id).toBe("sydney")
	})

	it("names nothing in the middle of nowhere", () => {
		expect(nearestCity(-50, -140)).toBeNull()
	})
})
