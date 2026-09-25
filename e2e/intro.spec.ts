import { expect, test, type Page } from "@playwright/test"

// The first ten seconds (#30): a first-time visitor gets the opening (close on
// Earth in true scale, pull back, the switch to Everything visible) and a
// hand-over with hints and a pulsing Earth; a returning visitor and a shared
// link never do. playwright.config.ts makes every visitor a returning one;
// these tests clear that to arrive for the first time.

test.describe.configure({ timeout: 180_000 })

const firstVisit = { storageState: { cookies: [], origins: [] } }

const handle = async (page: Page) =>
	page.waitForFunction(() => window.__astrolabe !== undefined, null, {
		timeout: 60_000,
	})

const state = (page: Page) =>
	page.evaluate(() => {
		const { view, selectedId, sequence, transition } =
			window.__astrolabe!.store.getState()
		const scale = window.__astrolabe!.scale.getState()
		return {
			view,
			selectedId,
			sequence:
				sequence === null
					? null
					: { index: sequence.index, phase: sequence.phase },
			steps: sequence?.steps.map((step) => step.durationMs ?? null) ?? null,
			transition: transition !== null,
			scale: scale.targetId,
			preset: scale.presetId,
		}
	})

const seen = (page: Page) =>
	page.evaluate(() => window.localStorage.getItem("astrolabe.introSeen"))

const skip = (page: Page) => page.getByTestId("intro-skip")
const hints = (page: Page) => page.getByTestId("intro-hints")

test.describe("a first visit", () => {
	test.use(firstVisit)

	test("opens close on Earth, pulls back in true scale and hands over in the default view", async ({
		page,
	}) => {
		await page.goto("/solar_system")
		// skippable from the very first frame
		await expect(skip(page)).toBeVisible({ timeout: 60_000 })
		await expect(page.getByTestId("intro")).toContainText("This is Earth.")
		await handle(page)
		const start = await state(page)
		expect(start.view).toEqual({ kind: "body", id: "earth" })
		expect(start.scale).toBe("trueScale")
		expect(start.sequence?.index).toBe(0)
		// the plan is under fifteen seconds
		const planned = await page.evaluate(() =>
			window
				.__astrolabe!.store.getState()
				.sequence!.steps.reduce(
					(ms, step) => ms + (step.durationMs ?? 0) + (step.holdMs ?? 0),
					0,
				),
		)
		expect(planned).toBeLessThan(15_000)
		expect(await seen(page)).toBe("1")

		// the pull-back: the Moon, the inner planets, the whole system
		await expect(page.getByTestId("intro")).toHaveAttribute(
			"data-beat",
			"system",
			{ timeout: 60_000 },
		)
		await expect(page.getByTestId("intro")).toHaveAttribute(
			"data-beat",
			"scale",
			{ timeout: 60_000 },
		)

		// hand-over: the overview a reset shows, in Everything visible, with hints and Earth pulsing
		await expect(hints(page)).toBeVisible({ timeout: 60_000 })
		await expect(page.getByTestId("intro")).toHaveCount(0)
		const end = await state(page)
		expect(end.view).toEqual({ kind: "overview" })
		expect(end.sequence).toBeNull()
		expect(end.scale).toBe("everythingVisible")
		await expect(page).not.toHaveURL(/[?&](focus|scale|cam)=/)
		await expect(hints(page)).toContainText("Click a planet to fly there")
		await expect(page.getByTestId("intro-pulse")).toHaveCSS(
			"visibility",
			"visible",
		)
		// Earth pulses where Earth is
		const earth = await page.evaluate(() =>
			window.__astrolabe!.screenOf("earth"),
		)
		const ring = await page.getByTestId("intro-pulse").boundingBox()
		expect(earth).not.toBeNull()
		expect(ring).not.toBeNull()
		expect(Math.abs(ring!.x + ring!.width / 2 - earth!.x)).toBeLessThan(
			ring!.width,
		)
		expect(Math.abs(ring!.y + ring!.height / 2 - earth!.y)).toBeLessThan(
			ring!.height,
		)

		// picking a planet stops the pulse
		await page.evaluate(() =>
			window.__astrolabe!.store.getState().setFocus("mars"),
		)
		await expect(page.getByTestId("intro-pulse")).toHaveCSS(
			"visibility",
			"hidden",
		)

		// a returning visitor goes straight to the overview
		await page.goto("/solar_system")
		await handle(page)
		await expect(page.getByTestId("intro")).toHaveCount(0)
		expect((await state(page)).sequence).toBeNull()
	})

	test("Skip ends it at once, from the first frame", async ({ page }) => {
		await page.goto("/solar_system")
		await skip(page).click({ timeout: 60_000 })
		await expect(page.getByTestId("intro")).toHaveCount(0)
		await expect(hints(page)).toBeVisible()
		await handle(page)
		const after = await state(page)
		expect(after.sequence).toBeNull()
		expect(after.view).toEqual({ kind: "overview" })
		expect(after.preset).toBe("everythingVisible")
	})

	test("a shared link opens exactly where it was taken, and the opening waits for a plain visit", async ({
		page,
	}) => {
		await page.goto("/solar_system?focus=jupiter&cam=-40_15_2")
		await handle(page)
		await page.waitForFunction(
			() => window.__astrolabe!.store.getState().transition === null,
		)
		await expect(page.getByTestId("intro")).toHaveCount(0)
		const view = await state(page)
		expect(view.view).toEqual({ kind: "body", id: "jupiter" })
		expect(view.sequence).toBeNull()
		expect(view.scale).toBe("everythingVisible")
		expect(await seen(page)).toBeNull()
	})

	test("a drag takes over: the opening ends and the planets grow back", async ({
		page,
	}) => {
		await page.goto("/solar_system")
		await handle(page)
		await expect(page.getByTestId("intro")).toHaveAttribute(
			"data-beat",
			"moon",
			{ timeout: 60_000 },
		)
		const box = (await page.locator("canvas").first().boundingBox())!
		const x = box.x + box.width * 0.3
		const y = box.y + box.height * 0.4
		await page.mouse.move(x, y)
		await page.mouse.down()
		await page.mouse.move(x + 120, y - 30, { steps: 6 })
		await page.mouse.up()
		await expect(page.getByTestId("intro")).toHaveCount(0)
		await expect(hints(page)).toBeVisible()
		const after = await state(page)
		expect(after.sequence).toBeNull()
		expect(after.scale).toBe("everythingVisible")
		// Earth, where the viewer took over, is still the view: nothing flew away
		expect(after.view).toEqual({ kind: "body", id: "earth" })
	})

	test("with reduced motion the shots are cuts", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" })
		await page.goto("/solar_system")
		await handle(page)
		await expect(skip(page)).toBeVisible()
		const start = await state(page)
		expect(start.steps).toEqual([0, 0, 0, 0, 0])
		await expect(page.getByTestId("intro")).toHaveAttribute(
			"data-beat",
			"inner",
			{ timeout: 60_000 },
		)
		expect(
			(await page.evaluate(() => window.__astrolabe!.camera())).durationMs ?? 0,
		).toBe(0)
		await expect(hints(page)).toBeVisible({ timeout: 60_000 })
		expect((await state(page)).preset).toBe("everythingVisible")
	})

	test("on a phone, in German at the simple level", async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
		})
		const page = await context.newPage()
		await page.goto("/solar_system?lang=de&reading=simple")
		await expect(page.getByTestId("intro")).toContainText("Das ist die Erde.", {
			timeout: 60_000,
		})
		const button = skip(page)
		await expect(button).toHaveText("Überspringen")
		const box = (await button.boundingBox())!
		expect(box.x).toBeGreaterThanOrEqual(0)
		expect(box.x + box.width).toBeLessThanOrEqual(390)
		expect(box.y + box.height).toBeLessThanOrEqual(844)
		await button.tap()
		await expect(hints(page)).toContainText(
			"Tippe auf einen Planeten, um ihn zu besuchen",
		)
		await expect(hints(page)).toContainText("Mit zwei Fingern zoomen")
		await context.close()
	})
})

test("a returning visitor replays it from the Help menu, and Escape ends it", async ({
	page,
}) => {
	await page.goto("/solar_system")
	await handle(page)
	await expect(page.getByTestId("intro")).toHaveCount(0)
	await page.getByTestId("intro-menu").click()
	await page.getByRole("menuitem", { name: "Play the opening again" }).click()
	await expect(page.getByTestId("intro")).toHaveAttribute("data-beat", "earth")
	expect((await state(page)).view).toEqual({ kind: "body", id: "earth" })
	await page.keyboard.press("Escape")
	await expect(page.getByTestId("intro")).toHaveCount(0)
	const after = await state(page)
	expect(after.view).toEqual({ kind: "overview" })
	expect(after.preset).toBe("everythingVisible")
})
