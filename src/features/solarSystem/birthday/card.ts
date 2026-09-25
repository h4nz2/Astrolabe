/**
 * The birthday result as a picture (issue #26, "shareable as an image"; the
 * general screenshot postcard is #33). Drawn with the Canvas 2D API on the
 * device and handed to the visitor as a PNG download: nothing is uploaded.
 *
 * The card shows the ages and the distance travelled, never the birth date
 * itself: whoever the picture is passed on to learns how old someone is on
 * Mars, not when they were born.
 */
import type { I18n } from "@/i18n"

import type { BirthdayFacts } from "./birthday"

/** Planet colours for the dots in the panel and on the card (the dominant colour of each texture). */
export const WORLD_COLORS: Readonly<Record<string, string>> = {
	sun: "#ffc94d",
	mercury: "#a8a29a",
	venus: "#e8c98f",
	earth: "#4f8fe8",
	moon: "#c9c9c9",
	mars: "#d9623b",
	jupiter: "#d8a878",
	io: "#e6d36a",
	europa: "#c8b89a",
	ganymede: "#9c8f80",
	callisto: "#6f665c",
	saturn: "#e3c887",
	titan: "#d9a441",
	uranus: "#8fd6dc",
	neptune: "#4a6fe0",
	triton: "#c7b6ae",
}

export const worldColor = (id: string): string => WORLD_COLORS[id] ?? "#999"

/** One line of the card: a world and the age there. */
export interface CardRow {
	id: string
	name: string
	age: string
}

/** Everything the card says, in the active language (pure, tested). */
export interface CardText {
	title: string
	date: string
	rows: CardRow[]
	distance: string
	footer: string
	fileName: string
}

export function cardText(
	facts: BirthdayFacts,
	i18n: I18n,
	name: (id: string) => string,
	formatDay: (day: string) => string,
	distance: string,
): CardText {
	return {
		title: i18n.t("solarSystem.birthday.card.title"),
		date: i18n.t("solarSystem.birthday.card.date", {
			date: formatDay(facts.today),
		}),
		rows: facts.worlds.map((world) => ({
			id: world.id,
			name: name(world.id),
			age: i18n.t("solarSystem.birthday.years.age", { age: world.age }),
		})),
		distance: i18n.t("solarSystem.birthday.card.distance", { distance }),
		footer: i18n.t("solarSystem.birthday.card.footer"),
		fileName: `${i18n.t("solarSystem.birthday.card.fileName")}.png`,
	}
}

const WIDTH = 1080
const HEIGHT = 1350
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

/** A deterministic sprinkle of stars (the same picture every time). */
function drawStars(ctx: CanvasRenderingContext2D): void {
	let seed = 26
	const random = () => {
		seed = (seed * 16807) % 2147483647
		return seed / 2147483647
	}
	for (let i = 0; i < 180; i++) {
		ctx.globalAlpha = 0.2 + random() * 0.6
		ctx.fillStyle = "#ffffff"
		ctx.beginPath()
		ctx.arc(random() * WIDTH, random() * HEIGHT, random() * 1.6 + 0.3, 0, 7)
		ctx.fill()
	}
	ctx.globalAlpha = 1
}

/** Shrinks the font until `text` fits `maxWidth`. */
function fitText(
	ctx: CanvasRenderingContext2D,
	text: string,
	weight: number,
	size: number,
	maxWidth: number,
): void {
	let px = size
	do {
		ctx.font = `${weight} ${px}px ${FONT}`
		px -= 2
	} while (ctx.measureText(text).width > maxWidth && px > 12)
}

/** Wraps `text` into lines no wider than `maxWidth` at the current font. */
function wrap(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	const lines: string[] = []
	let line = ""
	for (const word of text.split(" ")) {
		const next = line === "" ? word : `${line} ${word}`
		if (ctx.measureText(next).width > maxWidth && line !== "") {
			lines.push(line)
			line = word
		} else line = next
	}
	if (line !== "") lines.push(line)
	return lines
}

/** Paints the card onto a new canvas. */
export function drawCard(text: CardText): HTMLCanvasElement {
	const canvas = document.createElement("canvas")
	canvas.width = WIDTH
	canvas.height = HEIGHT
	const ctx = canvas.getContext("2d")
	if (ctx === null) return canvas

	const background = ctx.createLinearGradient(0, 0, 0, HEIGHT)
	background.addColorStop(0, "#141a2e")
	background.addColorStop(1, "#050609")
	ctx.fillStyle = background
	ctx.fillRect(0, 0, WIDTH, HEIGHT)
	drawStars(ctx)

	const margin = 80
	const inner = WIDTH - 2 * margin
	ctx.textBaseline = "alphabetic"
	ctx.fillStyle = "#ffffff"
	ctx.font = `700 60px ${FONT}`
	let y = 150
	for (const line of wrap(ctx, text.title, inner)) {
		ctx.fillText(line, margin, y)
		y += 72
	}
	ctx.fillStyle = "#f08c00"
	ctx.font = `500 34px ${FONT}`
	ctx.fillText(text.date, margin, y)
	y += 60

	const rowHeight = Math.min(96, (HEIGHT - y - 260) / text.rows.length)
	for (const row of text.rows) {
		y += rowHeight
		const middle = y - rowHeight / 2 + 12
		ctx.fillStyle = worldColor(row.id)
		ctx.beginPath()
		ctx.arc(margin + 22, middle - 12, 22, 0, Math.PI * 2)
		ctx.fill()
		ctx.fillStyle = "#e9ecef"
		fitText(ctx, row.name, 500, 42, inner * 0.4)
		ctx.textAlign = "left"
		ctx.fillText(row.name, margin + 70, middle)
		ctx.fillStyle = "#ffffff"
		fitText(ctx, row.age, 700, 46, inner * 0.55)
		ctx.textAlign = "right"
		ctx.fillText(row.age, WIDTH - margin, middle)
		ctx.textAlign = "left"
		ctx.strokeStyle = "rgba(255,255,255,0.08)"
		ctx.lineWidth = 2
		ctx.beginPath()
		ctx.moveTo(margin, y)
		ctx.lineTo(WIDTH - margin, y)
		ctx.stroke()
	}

	y += 80
	ctx.fillStyle = "#ced4da"
	ctx.font = `400 34px ${FONT}`
	for (const line of wrap(ctx, text.distance, inner)) {
		ctx.fillText(line, margin, y)
		y += 44
	}

	ctx.fillStyle = "#868e96"
	ctx.font = `500 28px ${FONT}`
	ctx.fillText(text.footer, margin, HEIGHT - 60)
	return canvas
}

/** Draws the card and hands it to the visitor as a download (local only). */
export function downloadCard(text: CardText): Promise<void> {
	const canvas = drawCard(text)
	return new Promise((resolve) => {
		canvas.toBlob((blob) => {
			if (blob !== null) {
				const url = URL.createObjectURL(blob)
				const link = document.createElement("a")
				link.href = url
				link.download = text.fileName
				document.body.append(link)
				link.click()
				link.remove()
				// give the browser a moment to start the download before the URL goes
				setTimeout(() => URL.revokeObjectURL(url), 10_000)
			}
			resolve()
		}, "image/png")
	})
}
