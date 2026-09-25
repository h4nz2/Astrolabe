import { expect, test, type Page } from "@playwright/test"

import { cameraAtRest } from "./support/scene"

// Fly between planets (#18), in the real browser: a second selection flies
// (pull back, travel, descend) with the distance and travel-time readout, and
// the flight can be skipped, retargeted and abandoned with Escape.

// software WebGL is slow and every step here waits for real flights to land
test.describe.configure({ timeout: 180_000 })

const ready = async (page: Page, url: string) => {
	await page.goto(url)
	await page.waitForFunction(() => window.__astrolabe !== undefined, null, {
		timeout: 30_000,
	})
	await cameraAtRest(page)
}

const camera = (page: Page) => page.evaluate(() => window.__astrolabe!.camera())

/** Starts a slow flight (so the headless page can watch it) the way a click does, plus a duration. */
const flySlowly = (page: Page, id: string, durationMs = 20_000) =>
	page.evaluate(
		({ id, durationMs }) => {
			const store = window.__astrolabe!.store.getState()
			store.select(id)
			store.focus(id, { profile: "fly", durationMs })
		},
		{ id, durationMs },
	)

const waitForProgress = (page: Page, at: number) =>
	page.waitForFunction(
		(at) => (window.__astrolabe!.camera().progress ?? 0) >= at,
		at,
		{ timeout: 60_000, polling: 100 },
	)

test("a second selection flies there, with the distance and the travel times", async ({
	page,
}) => {
	await ready(page, "/solar_system?focus=earth")
	const start = (await camera(page)).distance
	const readout = page.getByRole("region", { name: "Flight" })

	// the picker, like any selection from a focused body, starts the flight
	await page.getByRole("combobox", { name: "Focus body" }).click()
	await page.getByRole("option", { name: /^Jupiter/ }).click()
	await expect(readout).toBeVisible()
	await expect(readout.getByText("Earth → Jupiter")).toBeVisible()
	await expect(
		readout.getByText(/^\d+ million km apart on this date$/),
	).toBeVisible()
	await expect(readout.getByRole("listitem")).toHaveText([
		/^Light\s*\d+ minutes$/,
		/^New Horizons, the fastest launch ever\s*[\d.]+ years?$/,
		/^A car at 100 km\/h\s*[\d,]+ years$/,
	])
	await expect(readout.getByRole("button", { name: "Skip" })).toBeVisible()

	// the camera pulls far back on the way
	await page.waitForFunction(
		(start) => window.__astrolabe!.camera().distance > 100 * start,
		start,
		{ timeout: 60_000, polling: 100 },
	)
	await cameraAtRest(page)
	const landed = await camera(page)
	expect(landed.mode).toBe("focused")
	expect(landed.distance).toBeLessThan(10 * start)
	await expect(page).toHaveURL(/[?&]focus=jupiter(&|$)/)

	// the readout stays for the class to read, until closed
	await expect(readout).toHaveAttribute("data-arrived", "true")
	await expect(readout.getByText(/crossed/)).toHaveCount(0)
	await readout.getByRole("button", { name: "Close" }).click()
	await expect(readout).toHaveCount(0)
})

test("a flight can be skipped, retargeted and abandoned", async ({ page }) => {
	await ready(page, "/solar_system?focus=earth")
	const readout = page.getByTestId("flight-readout")

	// Skip lands at once and keeps the numbers
	await flySlowly(page, "saturn")
	await waitForProgress(page, 0.1)
	await expect(page.getByTestId("flight-crossed")).toHaveText(/crossed$/)
	await readout.getByRole("button", { name: "Skip" }).click()
	await cameraAtRest(page)
	expect((await camera(page)).mode).toBe("focused")
	await expect(readout).toHaveAttribute("data-arrived", "true")
	await expect(readout.getByText("Earth → Saturn")).toBeVisible()

	// a third selection mid-flight turns round from where the camera is
	await flySlowly(page, "neptune")
	await waitForProgress(page, 0.2)
	await page.evaluate(() =>
		window.__astrolabe!.store.getState().setFocus("mars"),
	)
	await expect(readout.getByText("Saturn → Mars")).toBeVisible()
	await cameraAtRest(page)
	expect(
		await page.evaluate(() => window.__astrolabe!.store.getState().focusId),
	).toBe("mars")

	// Escape mid-flight: the way out, and the readout goes with the trip
	await flySlowly(page, "venus")
	await waitForProgress(page, 0.3)
	await page.keyboard.press("Escape")
	await cameraAtRest(page)
	expect((await camera(page)).mode).toBe("overview")
	await expect(readout).toHaveCount(0)
})

test("true scale, in German at the simple reading level", async ({ page }) => {
	await ready(
		page,
		"/solar_system?focus=earth&scale=trueScale&lang=de&reading=simple",
	)
	await flySlowly(page, "moon", 8000)
	const readout = page.getByRole("region", { name: "Reise" })
	await expect(readout.getByText("Reise: Erde → Mond")).toBeVisible()
	await expect(readout.getByText(/^\d{3}\.\d{3} km weit weg$/)).toBeVisible()
	await expect(readout.getByRole("listitem").first()).toHaveText(
		/^Licht, das Schnellste, was es gibt\s*1,\d Sekunden$/,
	)
	await expect(
		readout.getByRole("button", { name: "Sofort hin" }),
	).toBeVisible()
	await cameraAtRest(page)
	expect((await camera(page)).mode).toBe("focused")
})
