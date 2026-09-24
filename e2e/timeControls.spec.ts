/**
 * The time controls (issue #14): reverse / pause / play with exactly one of
 * them pressed, speed presets that keep the direction, travelling to a named
 * moment or a picked day (stopping on arrival), and the too-fast hint.
 */
import { expect, test, type Locator, type Page } from "@playwright/test"

const J2000 = 2451545

// every test clicks through several panels while swiftshader renders the scene at a few fps
test.describe.configure({ timeout: 60_000 })
const DAY_MS = 86_400_000

/** The HUD date as epoch milliseconds (from `<time dateTime>`). */
async function shownTime(clock: Locator): Promise<number> {
	return Date.parse((await clock.getAttribute("datetime")) ?? "")
}

async function open(page: Page, search: string): Promise<Locator> {
	await page.goto(`/solar_system?${search}`)
	await page.waitForLoadState("networkidle")
	const clock = page.locator("time")
	await expect(clock).toBeVisible()
	return clock
}

const button = (page: Page, name: string) =>
	page.getByRole("button", { name, exact: true })

test("reverse, pause and play: one pressed, direction kept across speeds", async ({
	page,
}) => {
	const clock = await open(page, `t=${J2000}&warp=86400`)
	await expect(button(page, "Play")).toHaveAttribute("aria-pressed", "true")
	await expect(button(page, "Reverse")).toHaveAttribute("aria-pressed", "false")

	await button(page, "Reverse").click()
	await expect(button(page, "Reverse")).toHaveAttribute("aria-pressed", "true")
	await expect(button(page, "Play")).toHaveAttribute("aria-pressed", "false")
	await expect(page).toHaveURL(/[?&]warp=-86400(&|$)/)
	const before = await shownTime(clock)
	await expect
		.poll(() => shownTime(clock), { timeout: 20_000 })
		.toBeLessThan(before - DAY_MS)

	// a preset changes the speed and keeps running backwards; so does "+"
	await page.getByText("1 week/s", { exact: true }).click()
	await expect(page).toHaveURL(/[?&]warp=-604800(&|$)/)
	// hotkeys are the scene's once the preset gives the focus back
	await page.evaluate(() => (document.activeElement as HTMLElement).blur())
	await page.keyboard.press("+")
	await expect(page).toHaveURL(/[?&]warp=-2629800(&|$)/)
	await expect(page.getByRole("radio", { name: "1 month/s" })).toBeChecked()

	// pause keeps the direction for later; play runs forwards again
	await button(page, "Pause").click()
	await expect(button(page, "Pause")).toHaveAttribute("aria-pressed", "true")
	await expect(button(page, "Reverse")).toHaveAttribute("aria-pressed", "false")
	await page.evaluate(() => (document.activeElement as HTMLElement).blur())
	await page.keyboard.press("Space")
	await expect(button(page, "Reverse")).toHaveAttribute("aria-pressed", "true")
	await button(page, "Play").click()
	await expect(page).toHaveURL(/[?&]warp=2629800(&|$)/)
	await expect(button(page, "Play")).toHaveAttribute("aria-pressed", "true")
})

test("a named moment glides there and stops", async ({ page }) => {
	const clock = await open(page, `t=${J2000}`)
	await page.getByRole("button", { name: "Travel to a date" }).click()
	await page.getByRole("button", { name: /First Moon landing/ }).click()
	// the panel closes so the glide is in view, and the clock stops on arrival
	await expect(page.getByText("Travel in time")).toBeHidden()
	await expect(button(page, "Pause")).toHaveAttribute("aria-pressed", "true")
	await expect(clock).toHaveAttribute("datetime", "1969-07-20T20:17Z", {
		timeout: 20_000,
	})
	await expect(clock).toHaveText("Jul 20, 1969, 20:17 UTC")
	// paused, so the moment is in the link
	await expect(page).toHaveURL(/[?&]t=2440423\.3\d*(&|$)/)
})

test("a picked day is reached at noon UTC, in the viewer's language", async ({
	page,
}) => {
	const clock = await open(page, `t=${J2000}&lang=de`)
	await page.getByRole("button", { name: "Zu einem Datum reisen" }).click()
	await page.getByText("Datum wählen").click()
	// the calendar opens on the simulation's month, named by Intl in German
	await expect(page.getByText("Januar 2000")).toBeVisible()
	await expect(page.getByText("Mo", { exact: true })).toBeVisible()
	await page.getByRole("button", { name: "Samstag, 15. Januar 2000" }).click()
	await expect(clock).toHaveAttribute("datetime", "2000-01-15T12:00Z", {
		timeout: 20_000,
	})
	await expect(clock).toHaveText("15. Jan. 2000, 12:00 UTC")
	await expect(button(page, "Pause")).toHaveAttribute("aria-pressed", "true")
})

test("the calendar pages back through the decades to a birthday", async ({
	page,
}) => {
	const clock = await open(page, `t=${J2000}`)
	await page.getByRole("button", { name: "Travel to a date" }).click()
	await page.getByText("Pick a date").click()
	await page.getByRole("button", { name: "Pick another month" }).click()
	await page.getByRole("button", { name: "Pick another year" }).click()
	await expect(page.getByText("2000 – 2009")).toBeVisible()
	await page.getByRole("button", { name: "Previous decade" }).click()
	await page.getByRole("button", { name: "1995", exact: true }).click()
	await page.getByRole("button", { name: "Jul", exact: true }).click()
	await page.getByRole("button", { name: "Wednesday, July 12, 1995" }).click()
	await expect(clock).toHaveAttribute("datetime", "1995-07-12T12:00Z", {
		timeout: 20_000,
	})
})

test("warns when a body laps too fast to follow", async ({ page }) => {
	await open(page, `t=${J2000}&warp=315576000`)
	const hint = page.getByRole("status").filter({ hasText: "too fast" })
	await expect(hint).toContainText(/Mercury circles the Sun \d+ times a second/)
	await button(page, "Pause").click()
	await expect(hint).toBeHidden()
	await page.getByText("1x", { exact: true }).click()
	await button(page, "Play").click()
	await expect(hint).toBeHidden()
})
