/**
 * Axial rotation (issue #13): the spin control's named modes, judged from the
 * picture (a spinning Earth changes between two screenshots, a stopped one does
 * not) and from the facts panel (retrograde spin, tidal locking).
 */
import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"
import { closeTime, openLayers, openTime } from "./support/hud"

const screenshotDir = path.join("test-results", "rotation")

/** A screenshot of the page as PNG bytes, also saved for a human to look at. */
const shot = async (page: Page, name: string): Promise<string> => {
	mkdirSync(screenshotDir, { recursive: true })
	const png = await page.screenshot({
		path: path.join(screenshotDir, `${name}.png`),
	})
	return png.toString("base64")
}

/**
 * Mean absolute difference (0..255 per channel) between two screenshots inside
 * the central circle of the view, where the focused body's disc is.
 */
const discDifference = (page: Page, a: string, b: string): Promise<number> =>
	page.evaluate(
		async ([first, second]) => {
			const pixels = async (base64: string) => {
				const image = new Image()
				image.src = `data:image/png;base64,${base64}`
				await image.decode()
				const canvas = document.createElement("canvas")
				canvas.width = image.width
				canvas.height = image.height
				const context = canvas.getContext("2d")
				if (context === null) throw new Error("no 2d context")
				context.drawImage(image, 0, 0)
				return context.getImageData(0, 0, image.width, image.height)
			}
			const x = await pixels(first)
			const y = await pixels(second)
			const { width, height } = x
			const cx = width / 2
			const cy = height / 2
			const radius = 0.17 * height
			let sum = 0
			let count = 0
			for (let row = Math.round(cy - radius); row < cy + radius; row++) {
				for (let col = Math.round(cx - radius); col < cx + radius; col++) {
					if (Math.hypot(col - cx, row - cy) > radius) continue
					const o = (row * width + col) * 4
					sum +=
						Math.abs(x.data[o] - y.data[o]) +
						Math.abs(x.data[o + 1] - y.data[o + 1]) +
						Math.abs(x.data[o + 2] - y.data[o + 2])
					count += 3
				}
			}
			return sum / count
		},
		[a, b],
	)

const canvas = (page: Page) => page.locator("canvas").first()
const spinGroup = (page: Page) => page.getByRole("radiogroup", { name: "Spin" })

test("the spin control has named modes, Realistic first, and says when spin is not to the clock", async ({
	page,
}) => {
	await page.goto("/solar_system?focus=earth")
	await page.waitForLoadState("networkidle")
	// the spin waits behind the time bar's speed button (#42)
	await openTime(page)
	const group = spinGroup(page)
	await expect(group).toBeVisible()
	await expect(group.getByRole("radio")).toHaveCount(4)
	await expect(group.getByRole("radio", { name: "Realistic" })).toBeChecked()
	await expect(canvas(page)).toHaveAttribute("data-spin-mode", "realistic")
	const notice = page.getByText("Not true to the clock", { exact: false })
	await expect(notice).toHaveCount(0)

	await group.getByText("Slow motion").click()
	await expect(canvas(page)).toHaveAttribute("data-spin-mode", "slow")
	await expect(notice).toBeVisible()

	await group.getByText("Realistic").click()
	await expect(canvas(page)).toHaveAttribute("data-spin-mode", "realistic")
	await expect(notice).toHaveCount(0)
})

test("Earth turns under the clock in the realistic mode and holds still when spin is stopped", async ({
	page,
}) => {
	// four full screenshots of a WebGL canvas: several seconds each in software rendering
	test.slow()
	// one hour per second: Earth turns 15 degrees every real second
	await page.goto("/solar_system?focus=earth&t=2461212.5&warp=3600")
	await page.waitForLoadState("networkidle")
	await expect(page.getByRole("combobox", { name: "Focus body" })).toHaveValue(
		"Earth",
	)
	// the whole face lit, so every part of the texture shows its motion
	await openLayers(page)
	await page.getByRole("switch", { name: "Always lit" }).click({ force: true })
	await page.waitForTimeout(2000)

	const turning1 = await shot(page, "earth-realistic-1")
	await page.waitForTimeout(1500)
	const turning2 = await shot(page, "earth-realistic-2")
	const turning = await discDifference(page, turning1, turning2)

	await openTime(page)
	await spinGroup(page).getByText("Stopped").click()
	await expect(canvas(page)).toHaveAttribute("data-spin-mode", "stopped")
	await closeTime(page)
	await page.waitForTimeout(1000)
	const still1 = await shot(page, "earth-stopped-1")
	await page.waitForTimeout(1500)
	const still2 = await shot(page, "earth-stopped-2")
	const still = await discDifference(page, still1, still2)

	expect(turning).toBeGreaterThan(8)
	expect(still).toBeLessThan(2)
	expect(turning).toBeGreaterThan(5 * still)
})

test("the facts panel shows retrograde spin and tidal locking", async ({
	page,
}) => {
	await page.goto("/solar_system?focus=venus")
	await page.waitForLoadState("networkidle")
	const info = page.getByRole("region", { name: "Focused body" })
	await expect(info).toContainText("243 days, retrograde")

	await page.goto("/solar_system?focus=moon")
	await page.waitForLoadState("networkidle")
	await expect(info).toContainText("always the same face toward Earth")
})
