/**
 * Sunlight, day and night (issue #22), judged from the picture: a planet seen
 * from the side shows a lit day side and a dark but still visible night side
 * (never the background colour), and "Always lit" lights the whole face.
 */
import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

const screenshotDir = path.join("test-results", "lighting")

// headless chromium noise that is not an app bug
const ignoredConsoleErrors = [
	"WebGL",
	"GPU",
	"swiftshader",
	"GroupMarkerNotSet",
]

const collectErrors = (page: Page): string[] => {
	const errors: string[] = []
	page.on("pageerror", (error) => errors.push(error.message))
	page.on("console", (message) => {
		if (message.type() !== "error") return
		const text = message.text()
		if (ignoredConsoleErrors.some((needle) => text.includes(needle))) return
		errors.push(text)
	})
	return errors
}

interface DiscPixels {
	/** clearly sunlit */
	day: number
	/** visibly above the background, but dark: the night side */
	night: number
	/** the background colour (#0b0d12) or nearly */
	space: number
}

/**
 * Classifies the pixels of the focused body's disc: the central circle of
 * the view (the 6-radii framing puts the disc well inside it), counted in the
 * page itself so no image library is needed.
 */
const discPixels = async (page: Page, name: string): Promise<DiscPixels> => {
	mkdirSync(screenshotDir, { recursive: true })
	const png = await page.screenshot({
		path: path.join(screenshotDir, `${name}.png`),
	})
	return page.evaluate(async (base64) => {
		const image = new Image()
		image.src = `data:image/png;base64,${base64}`
		await image.decode()
		const canvas = document.createElement("canvas")
		canvas.width = image.width
		canvas.height = image.height
		const context = canvas.getContext("2d")
		if (context === null) return { day: -1, night: -1, space: -1 }
		context.drawImage(image, 0, 0)
		const { width, height } = canvas
		const data = context.getImageData(0, 0, width, height).data
		const cx = width / 2
		const cy = height / 2
		// the disc spans about 0.41 of the height at the 6-radii framing; stay inside it
		const radius = 0.17 * height
		const counts = { day: 0, night: 0, space: 0 }
		for (let y = Math.round(cy - radius); y < cy + radius; y++) {
			for (let x = Math.round(cx - radius); x < cx + radius; x++) {
				if (Math.hypot(x - cx, y - cy) > radius) continue
				const o = (y * width + x) * 4
				const d =
					Math.abs(data[o] - 0x0b) +
					Math.abs(data[o + 1] - 0x0d) +
					Math.abs(data[o + 2] - 0x12)
				if (d > 120) counts.day++
				else if (d > 6) counts.night++
				else counts.space++
			}
		}
		return counts
	}, png.toString("base64"))
}

test("a planet shows a day side and a night side that is dark but never lost, and Always lit lights it all", async ({
	page,
}) => {
	const errors = collectErrors(page)
	// 23 March 2026: the default framing sees the Earth from the side, half in sunlight
	await page.goto("/solar_system?focus=earth&t=2461122.5")
	await page.waitForLoadState("networkidle")
	await expect(page.getByRole("combobox", { name: "Focus body" })).toHaveValue(
		"Earth",
	)
	await page.waitForTimeout(2000)

	const honest = await discPixels(page, "earth-honest")
	const total = honest.day + honest.night + honest.space
	// a terminator: plenty of both
	expect(honest.day).toBeGreaterThan(0.2 * total)
	expect(honest.night).toBeGreaterThan(0.2 * total)
	// the night side is not the colour of space
	expect(honest.space).toBeLessThan(0.02 * total)

	const alwaysLit = page.getByRole("switch", { name: "Always lit" })
	await expect(alwaysLit).not.toBeChecked()
	await alwaysLit.click({ force: true })
	await expect(alwaysLit).toBeChecked()
	await page.waitForTimeout(1000)
	const lit = await discPixels(page, "earth-always-lit")
	expect(lit.day).toBeGreaterThan(0.9 * total)
	expect(lit.night).toBeLessThan(0.3 * honest.night)

	await alwaysLit.click({ force: true })
	await expect(alwaysLit).not.toBeChecked()
	await page.waitForTimeout(1000)
	const back = await discPixels(page, "earth-honest-again")
	expect(back.night).toBeGreaterThan(0.2 * total)
	expect(errors).toEqual([])
})
