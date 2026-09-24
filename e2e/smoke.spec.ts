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
		await expect(page.getByRole("checkbox")).toHaveCount(3)
		await expect(page.getByText("Red Giant")).toBeVisible()
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
