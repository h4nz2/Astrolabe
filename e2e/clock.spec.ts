/**
 * The simulation clock (issue #9), seen through the HUD date: it runs at the
 * chosen speed whatever the frame rate, runs backwards at a negative warp,
 * freezes on pause, and time travel passes through the dates in between
 * instead of teleporting.
 */
import { expect, test, type Locator, type Page } from "@playwright/test"

const J2000 = 2451545
const DAY_MS = 86_400_000

/** The HUD clock: its text is localized (#11), its `dateTime` is the ISO instant. */
const clockOf = (page: Page): Locator => page.locator("time")

/** The HUD date ("2000-01-01T12:00Z" in `dateTime`) as epoch milliseconds. */
async function shownTime(clock: Locator): Promise<number> {
	return Date.parse((await clock.getAttribute("datetime")) ?? "")
}

/** Opens the solar system at `search` and waits until the scene has settled. */
async function open(page: Page, search: string): Promise<Locator> {
	await page.goto(`/solar_system?${search}`)
	await page.waitForLoadState("networkidle")
	const clock = clockOf(page)
	await expect(clock).toBeVisible()
	return clock
}

test("the clock runs at the chosen speed, whatever the frame rate", async ({
	page,
}) => {
	// one simulated day per real second. Headless software rendering draws only
	// a few frames per second (fewer still under a parallel test run); the clock
	// must advance by the real time elapsed, not per frame. Only frame gaps over
	// 250 ms (a stalled or hidden page) count partly, by design.
	const clock = await open(page, `t=${J2000}&warp=86400`)
	await page.evaluate(() => {
		const w = window as unknown as { countedMs: number }
		w.countedMs = 0
		let last = performance.now()
		const frame = () => {
			const now = performance.now()
			w.countedMs += Math.min(now - last, 250)
			last = now
			requestAnimationFrame(frame)
		}
		requestAnimationFrame(frame)
	})
	// the HUD date and the counted real time, read in the same instant
	const sample = () =>
		clock.evaluate((element) => ({
			shown: Date.parse(element.getAttribute("datetime") ?? ""),
			countedMs: (window as unknown as { countedMs: number }).countedMs,
		}))
	await page.waitForTimeout(500)
	const first = await sample()
	await page.waitForTimeout(4000)
	const second = await sample()
	const simulatedDays = (second.shown - first.shown) / DAY_MS
	const countedSeconds = (second.countedMs - first.countedMs) / 1000
	expect(countedSeconds).toBeGreaterThan(1)
	// the HUD shows the clock at 10 Hz, so each reading may lag by a frame and a tenth of a second
	expect(Math.abs(simulatedDays - countedSeconds)).toBeLessThan(0.5)
})

test("a negative warp runs the clock backwards and survives in the link", async ({
	page,
}) => {
	const clock = await open(page, `t=${J2000}&warp=-86400`)
	const before = await shownTime(clock)
	// a day per second; polled, because a loaded headless run may stall frames
	await expect
		.poll(() => shownTime(clock), { timeout: 20_000 })
		.toBeLessThan(before - 2 * DAY_MS)
	await expect(page).toHaveURL(/[?&]warp=-86400(&|$)/)
})

test("pause freezes the clock where it is", async ({ page }) => {
	const clock = await open(page, `t=${J2000}&warp=86400`)
	await page.keyboard.press("Space")
	await expect(page.getByRole("button", { name: "Play" })).toBeVisible()
	// the HUD refreshes the date at 10 Hz: let it show the pinned value first
	await page.waitForTimeout(500)
	const frozen = await clock.innerText()
	await page.waitForTimeout(2000)
	await expect(clock).toHaveText(frozen)
})

test("Now travels to the present through the dates in between", async ({
	page,
}) => {
	const clock = await open(page, `t=${J2000}`)
	// paused, so every change of the date comes from the time travel itself
	await page.keyboard.press("Space")
	await expect(page.getByRole("button", { name: "Play" })).toBeVisible()
	const start = await shownTime(clock)

	await page.getByRole("button", { name: "Now" }).click()
	// sample every date shown on the way (a loaded headless run may stall
	// frames, which holds the glide, so poll instead of timing it)
	const seen: number[] = []
	await expect
		.poll(
			async () => {
				const shown = await shownTime(clock)
				if (seen.at(-1) !== shown) seen.push(shown)
				return Math.abs(shown - Date.now())
			},
			{ timeout: 20_000, intervals: [50] },
		)
		.toBeLessThan(5 * 60_000)
	const end = seen.at(-1)!
	// the date swept forward through the years in between, never backwards
	const between = seen.filter((t) => t > start + DAY_MS && t < end - DAY_MS)
	expect(between.length).toBeGreaterThan(0)
	for (let i = 1; i < seen.length; i++) {
		expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
	}
	// and it has landed, still paused
	await expect(page.getByRole("button", { name: "Play" })).toBeVisible()
})
