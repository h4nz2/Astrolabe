import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

// Every route renders a three.js <Canvas>; the per-route check asserts a piece of real UI
// so a crashed feature (or the router's error component) cannot pass as "rendered".
const routes: Record<string, (page: Page) => Promise<void>> = {
	"/": async (page) => {
		await expect(
			page.getByRole("heading", { name: /to the stars/i }),
		).toBeVisible()
		await expect(page.getByRole("link", { name: "Dictionary" })).toBeVisible()
		await expect(page.getByRole("link", { name: "Solar Model" })).toBeVisible()
	},
	"/solar_dictionary": async (page) => {
		// sidebar of the default selection (the Sun)
		await expect(page.getByText("Sun", { exact: true })).toBeVisible()
		await expect(page.getByText("diameter", { exact: true })).toBeVisible()
	},
	"/solar_system": async (page) => {
		// the HUD over the canvas: focus picker (on the Sun), play/pause, layer switches, the clock
		const focus = page.getByRole("combobox", { name: "Focus body" })
		await expect(focus).toBeVisible()
		await expect(focus).toHaveValue("Sun")
		await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()
		await expect(page.getByRole("switch")).toHaveCount(4)
		await expect(
			page.getByText(/^-?\d{4,}-\d{2}-\d{2} \d{2}:\d{2} UTC$/),
		).toBeVisible()
	},
}

// headless chromium noise that is not an app bug
const ignoredConsoleErrors = [
	"WebGL",
	"GPU",
	"swiftshader",
	"GroupMarkerNotSet",
]

const screenshotDir =
	process.env.SMOKE_SCREENSHOT_DIR ?? path.join("test-results", "smoke")

const screenshotName = (route: string) =>
	route === "/" ? "index" : route.replace(/^\//, "").replace(/\//g, "_")

for (const [route, expectRouteUI] of Object.entries(routes)) {
	test(`renders ${route}`, async ({ page }) => {
		// a full-page screenshot of a WebGL canvas takes several seconds in software
		// rendering, and over 30 s for the solar system under a parallel run
		test.slow()
		const errors: string[] = []
		page.on("console", (message) => {
			if (message.type() !== "error") return
			const text = message.text()
			if (ignoredConsoleErrors.some((needle) => text.includes(needle))) return
			errors.push(text)
		})
		page.on("pageerror", (error) => errors.push(error.message))

		await page.goto(route)
		await page.waitForLoadState("networkidle")

		await expect(page.locator("canvas").first()).toBeAttached()
		await expectRouteUI(page)

		mkdirSync(screenshotDir, { recursive: true })
		await page.screenshot({
			path: path.join(screenshotDir, `${screenshotName(route)}.png`),
			fullPage: true,
		})

		expect(errors).toEqual([])
	})
}

test("a solar system deep link seeds the simulation and the HUD writes back to the URL", async ({
	page,
}) => {
	await page.goto("/solar_system?focus=io&warp=60")
	const focus = page.getByRole("combobox", { name: "Focus body" })
	await expect(focus).toHaveValue("Io")
	await expect(page.getByRole("radio", { name: "1 min/s" })).toBeChecked()

	// the arrows cycle the focus among siblings (Io -> Europa) and the URL follows
	await page.keyboard.press("ArrowRight")
	await expect(focus).toHaveValue("Europa")
	await expect(page).toHaveURL(/[?&]focus=europa(&|$)/)
	await expect(page).toHaveURL(/[?&]warp=60(&|$)/)

	// Space pauses, which pins the simulation time into the URL
	await page.keyboard.press("Space")
	await expect(page.getByRole("button", { name: "Play" })).toBeVisible()
	await expect(page).toHaveURL(/[?&]t=\d+(\.\d+)?(&|$)/)
})

test("hiding the moons with the orbits on keeps the scene alive and the focused moon in place", async ({
	page,
}) => {
	const errors: string[] = []
	page.on("pageerror", (error) => errors.push(error.message))
	page.on("console", (message) => {
		if (message.type() === "error" && message.text().includes("R3F")) {
			errors.push(message.text())
		}
	})
	await page.goto("/solar_system?focus=io")
	const focus = page.getByRole("combobox", { name: "Focus body" })
	await expect(focus).toHaveValue("Io")
	await expect(page.getByRole("switch", { name: "Orbits" })).toBeChecked()
	const moons = page.getByRole("switch", { name: "Moons" })
	await expect(moons).toBeChecked()

	// Mantine's transparent switch input covers its label and intercepts the pointer,
	// so click the input itself. Every mounted orbit line re-renders here (the R3F
	// <threeLine> update path).
	await moons.click({ force: true })
	await expect(moons).not.toBeChecked()
	await expect(page.locator("canvas").first()).toBeAttached()
	await expect(focus).toHaveValue("Io")
	await expect(page.getByText(/something went wrong/i)).toHaveCount(0)

	await moons.click({ force: true })
	await expect(moons).toBeChecked()
	await expect(page.locator("canvas").first()).toBeAttached()
	await expect(page.getByText(/something went wrong/i)).toHaveCount(0)
	expect(errors).toEqual([])
})

test("a link without a usable t starts at the wall clock, not at JD 0", async ({
	page,
}) => {
	// `?t=` reaches the schema as "" and must count as absent (coercion would make it 0)
	await page.goto("/solar_system?t=&warp=")
	const clock = page.getByText(/^-?\d{4,}-\d{2}-\d{2} \d{2}:\d{2} UTC$/)
	await expect(clock).toBeVisible()
	const shown = new Date(
		(await clock.innerText()).replace(" UTC", "Z").replace(" ", "T"),
	)
	expect(Math.abs(shown.getTime() - Date.now())).toBeLessThan(2 * 60_000)
	await expect(page.getByRole("radio", { name: "1x" })).toBeChecked()
	await expect(page).not.toHaveURL(/[?&]t=0(&|$)/)
})

test("unknown URLs render the not-found page with a way back", async ({
	page,
}) => {
	await page.goto("/does-not-exist")
	await expect(
		page.getByRole("heading", { name: /lost in space/i }),
	).toBeVisible()
	await page.getByRole("link", { name: /back to the stars/i }).click()
	await expect(
		page.getByRole("heading", { name: /to the stars/i }),
	).toBeVisible()
})
