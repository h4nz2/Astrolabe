/**
 * The simulation clock (issue #9), seen through the HUD date: it runs at the
 * chosen speed whatever the frame rate, runs backwards at a negative warp,
 * freezes on pause, and time travel passes through the dates in between
 * instead of teleporting.
 */
import { expect, test, type Locator, type Page } from "@playwright/test"

import { nextFrames } from "./support/scene"
import { openTime } from "./support/hud"

const J2000 = 2451545
const DAY_MS = 86_400_000

/** A HUD date and the real time counted up to the frame that computed it. */
interface ClockSample {
	shown: number
	countedMs: number
}

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
	// 250 ms (a stalled or hidden page) count partly, by design, so on a loaded
	// machine four counted seconds can take much longer than four.
	test.slow()
	await open(page, `t=${J2000}&warp=86400`)
	await page.waitForFunction(() => window.__astrolabe !== undefined)
	// Every time the HUD date changes, note it with the real time counted up to
	// the frame that computed it (the store's lastTickMs). The HUD shows the
	// clock at 10 Hz and a loaded run draws a frame a second or less, so reading
	// the HUD at an arbitrary instant would see a date up to a frame old.
	await page.evaluate(() => {
		const probe = window as unknown as { samples: ClockSample[] }
		probe.samples = []
		// every frame's start and the real time counted up to it
		const frames: { at: number; countedMs: number }[] = []
		let countedMs = 0
		let last = performance.now()
		frames.push({ at: last, countedMs })
		const frame = () => {
			const now = performance.now()
			countedMs += Math.min(Math.max(now - last, 0), 250)
			last = now
			frames.push({ at: now, countedMs })
			requestAnimationFrame(frame)
		}
		requestAnimationFrame(frame)
		// the count at any instant: its frame's, plus the time since (capped the same way)
		const countedAt = (at: number): number | null => {
			for (let i = frames.length - 1; i >= 0; i--) {
				if (frames[i].at <= at) {
					return frames[i].countedMs + Math.min(at - frames[i].at, 250)
				}
			}
			return null
		}
		const time = document.querySelector("time")!
		new MutationObserver(() => {
			const { lastTickMs } = window.__astrolabe!.store.getState()
			// a date computed before the count began cannot be paired with it
			const countedMs = lastTickMs === null ? null : countedAt(lastTickMs)
			if (countedMs === null) return
			probe.samples.push({
				shown: Date.parse(time.getAttribute("datetime") ?? ""),
				countedMs,
			})
		}).observe(time, { attributes: true, attributeFilter: ["datetime"] })
	})
	// wait for four seconds of counted real time, however long that takes
	await page.waitForFunction(() => {
		const { samples } = window as unknown as { samples: ClockSample[] }
		return (
			samples.length >= 2 &&
			samples.at(-1)!.countedMs - samples[0].countedMs >= 4000
		)
	})
	const samples = await page.evaluate(
		() => (window as unknown as { samples: ClockSample[] }).samples,
	)
	const first = samples[0]
	const second = samples.at(-1)!
	const simulatedDays = (second.shown - first.shown) / DAY_MS
	const countedSeconds = (second.countedMs - first.countedMs) / 1000
	expect(countedSeconds).toBeGreaterThan(1)
	// each HUD date is exact to the minute it shows (1/1440 of a day here)
	expect(Math.abs(simulatedDays - countedSeconds)).toBeLessThan(0.05)
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
	await expect(
		page.getByRole("button", { name: "Pause", pressed: true }),
	).toBeVisible()
	// the HUD refreshes the date at 10 Hz: let it show the pinned value first
	await page.waitForFunction(() => window.__astrolabe !== undefined)
	const pinned = await page.evaluate(() => {
		const { simTimeJD } = window.__astrolabe!.store.getState()
		return Math.round((simTimeJD - 2440587.5) * 86_400_000)
	})
	await expect
		.poll(() => shownTime(clock))
		.toBe(Math.floor(pinned / 60_000) * 60_000)
	const frozen = await clock.innerText()
	// two seconds would be two simulated days, and the page keeps drawing frames
	await page.waitForTimeout(2000)
	await nextFrames(page)
	await expect(clock).toHaveText(frozen)
})

test("Now travels to the present through the dates in between", async ({
	page,
}) => {
	const clock = await open(page, `t=${J2000}`)
	// paused, so every change of the date comes from the time travel itself
	await page.keyboard.press("Space")
	await expect(
		page.getByRole("button", { name: "Pause", pressed: true }),
	).toBeVisible()
	const start = await shownTime(clock)

	await openTime(page)
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
	await expect(
		page.getByRole("button", { name: "Pause", pressed: true }),
	).toBeVisible()
})
