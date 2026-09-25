import { expect, test } from "@playwright/test"

// More comparison ideas (#40): a grouped menu of ready-made comparisons, each
// with a teaser that states its surprise. Picking one puts it in the link,
// names it above the facts and leads with the comparison that makes its point.

test("an idea is picked from the grouped menu and leads with its point", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 720 })
	await page.goto("/compare?bodies=earth,saturn&lang=en&reading=standard")
	await expect(page.getByTestId("compare-idea")).toHaveCount(0)

	await page.getByTestId("compare-presets").click()
	const menu = page.getByRole("menu")
	for (const group of ["Sizes", "Moons", "Surprises"]) {
		await expect(menu.getByText(group, { exact: true })).toBeVisible()
	}
	await expect(page.getByRole("menuitem")).toHaveCount(14)
	const twin = page.getByRole("menuitem", { name: /Earth’s twin/ })
	await expect(twin).toContainText("hot enough to melt lead")
	await twin.click()

	await expect(page).toHaveURL(/bodies=venus%2Cearth|bodies=venus,earth/)
	const idea = page.getByTestId("compare-idea")
	await expect(idea).toContainText("Earth’s twin")
	await expect(idea).toContainText("hot enough to melt lead")
	const facts = page.getByTestId("compare-facts")
	await expect(facts.locator("[data-fact]").first()).toHaveAttribute(
		"data-fact",
		"size",
	)

	// swapping the pair keeps the idea; adding a body leaves it
	await page.getByRole("button", { name: "Swap the two" }).click()
	await expect(idea).toBeVisible()

	// another idea leads with a different fact
	await page.getByTestId("compare-presets").click()
	await page
		.getByRole("menuitem", { name: /Where would you weigh the most/ })
		.click()
	await expect(idea).toContainText("Where would you weigh the most?")
	await expect(facts.locator("[data-fact]").first()).toHaveAttribute(
		"data-fact",
		"weight",
	)
	await page.getByRole("button", { name: "Remove Mars" }).click()
	await expect(idea).toHaveCount(0)
})

test("an idea's link opens it in another language and reading level", async ({
	page,
}) => {
	await page.goto(
		"/compare?bodies=ganymede,mercury,titan&lang=de&reading=simple",
	)
	const idea = page.getByTestId("compare-idea")
	await expect(idea).toContainText("Monde, größer als ein Planet")
	await expect(idea).toContainText("Zwei Monde sind größer als ein Planet!")

	await page.goto("/compare?bodies=io,ganymede,europa,callisto,moon&lang=fr")
	await expect(idea).toContainText("Les quatre lunes de Galilée")
	await expect(
		page.getByTestId("compare-facts").locator("[data-fact]").first(),
	).toHaveAttribute("data-fact", "orbit")
})
