import { mkdirSync } from "node:fs"
import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

// The scale engine (#8): the app opens in the "Everything visible" preset, not
// at true scale. At true scale the default view (the overview of the planetary
// system, #10) shows the inner planets packed into a few pixels round the Sun;
// in Everything visible the inner planets' orbits ring the Sun inside the same frame.

const screenshotDir = path.join("test-results", "scale")

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

/**
 * Pixels in the middle of the view (clear of the HUD panels and of the Sun's
 * disc) that differ visibly from the background, counted in the page itself so
 * no image library is needed.
 */
const litPixelsAroundCentre = async (page: Page): Promise<number> => {
	const png = await page.screenshot()
	return page.evaluate(async (base64) => {
		const image = new Image()
		image.src = `data:image/png;base64,${base64}`
		await image.decode()
		const canvas = document.createElement("canvas")
		canvas.width = image.width
		canvas.height = image.height
		const context = canvas.getContext("2d")
		if (context === null) return -1
		context.drawImage(image, 0, 0)
		const { width, height } = canvas
		const data = context.getImageData(0, 0, width, height).data
		const cx = width / 2
		const cy = height / 2
		const sunClearance = 0.1 * height
		let lit = 0
		for (let y = Math.round(0.12 * height); y < 0.8 * height; y++) {
			for (let x = Math.round(0.25 * width); x < 0.75 * width; x++) {
				if (Math.hypot(x - cx, y - cy) < sunClearance) continue
				const o = (y * width + x) * 4
				// the scene background is #0b0d12
				const d =
					Math.abs(data[o] - 0x0b) +
					Math.abs(data[o + 1] - 0x0d) +
					Math.abs(data[o + 2] - 0x12)
				if (d > 60) lit++
			}
		}
		return lit
	}, png.toString("base64"))
}

test("the solar system opens in Everything visible, with the inner planets' orbits around the Sun", async ({
	page,
}) => {
	// the full Sun view with every orbit line is the heaviest frame in software WebGL:
	// two full-page screenshots take over 30 s under a parallel run
	test.slow()
	const errors = collectErrors(page)
	await page.goto("/solar_system")
	await page.waitForLoadState("networkidle")
	const canvas = page.locator("canvas").first()
	await expect(canvas).toHaveAttribute("data-scale-preset", "everythingVisible")
	await expect(page.getByRole("combobox", { name: "Focus body" })).toHaveValue(
		"Sun",
	)
	// the camera settles (smooth time 0.4 s) before the picture is judged
	await page.waitForTimeout(1500)
	mkdirSync(screenshotDir, { recursive: true })
	await page.screenshot({ path: path.join(screenshotDir, "open-default.png") })

	// orbit lines of Mercury..Mars cross the middle of the view (thousands of
	// pixels); at true scale this region would be empty
	expect(await litPixelsAroundCentre(page)).toBeGreaterThan(1500)
	expect(errors).toEqual([])
})

test("the Markers switch hides the planets' dots, so small bodies shrink to their true size", async ({
	page,
}) => {
	// two full-page pixel counts under software WebGL
	test.slow()
	const errors = collectErrors(page)
	// a fixed date keeps the planets where the pixel counts expect them
	await page.goto("/solar_system?t=2461308")
	await page.waitForLoadState("networkidle")
	await page.waitForTimeout(1500)
	// without the orbit lines the planets' dots are all that is lit round the Sun
	const orbits = page.getByRole("switch", { name: "Orbits" })
	await orbits.click({ force: true })
	await expect(orbits).not.toBeChecked()
	await page.waitForTimeout(500)
	const withMarkers = await litPixelsAroundCentre(page)

	const markers = page.getByRole("switch", { name: "Markers" })
	await expect(markers).toBeChecked()
	await markers.click({ force: true })
	await expect(markers).not.toBeChecked()
	await page.waitForTimeout(500)
	const withoutMarkers = await litPixelsAroundCentre(page)

	expect(withMarkers).toBeGreaterThan(withoutMarkers + 20)
	expect(errors).toEqual([])
})

test("a focused planet is framed from its drawn size and its moons stay in place with the moons toggled", async ({
	page,
}) => {
	const errors = collectErrors(page)
	await page.goto("/solar_system?focus=jupiter")
	await page.waitForLoadState("networkidle")
	const canvas = page.locator("canvas").first()
	await expect(canvas).toHaveAttribute("data-scale-preset", "everythingVisible")
	await expect(page.getByRole("combobox", { name: "Focus body" })).toHaveValue(
		"Jupiter",
	)
	await page.waitForTimeout(1500)
	// Jupiter fills the middle of the view: it was framed from its drawn radius
	expect(await litPixelsAroundCentre(page)).toBeGreaterThan(20_000)
	mkdirSync(screenshotDir, { recursive: true })
	await page.screenshot({ path: path.join(screenshotDir, "jupiter.png") })

	// every orbit line re-derives from the scaled values on a layer toggle
	const moons = page.getByRole("switch", { name: "Moons" })
	await moons.click({ force: true })
	await expect(moons).not.toBeChecked()
	await moons.click({ force: true })
	await expect(moons).toBeChecked()
	await expect(canvas).toBeAttached()
	await expect(page.getByText(/something went wrong/i)).toHaveCount(0)
	expect(errors).toEqual([])
})
