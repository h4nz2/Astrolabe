/**
 * Paints the postcard (issue #33) with the Canvas 2D API, on the device: the
 * scene's picture in a dark mount with a thin frame, the names that were on
 * screen painted back over it, and the stamp below: title, date, caption,
 * extra facts (the birthday ages), the scale statement, the app's name and an
 * optional QR code that opens the view.
 *
 * Every size derives from one unit `u` (`postcardUnit`, from the picture's size),
 * so a phone's portrait picture and a projector's landscape one look alike.
 */
import type { SceneShot, ShotLabel } from "@/store/postcard"

import type { PostcardText } from "./postcard"

export const POSTCARD_FONT =
	"system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

export interface PostcardOptions {
	/** Paint the names that were on screen. */
	names: boolean
	/** The caption as the visitor left it ("" for none). */
	caption: string
	/** QR modules (true = dark) of the link, or none. */
	qr: readonly (readonly boolean[])[] | null
}

/**
 * The size unit of a picture `width` x `height` px: a 34th of its short side,
 * or a 60th of its long side if more (a tall phone picture keeps legible text).
 */
export const postcardUnit = (width: number, height: number): number =>
	Math.max(8, Math.min(width, height) / 34, Math.max(width, height) / 60)

/** Columns of the extra facts: 4 beside a landscape picture, 2 below a portrait one. */
export const rowColumns = (width: number, height: number, count: number) =>
	Math.max(1, Math.min(count, width >= height ? 4 : 2))

/** Splits `text` into lines no wider than `maxWidth` at the current font; words longer than a line stay whole. */
export function wrapText(
	measure: (text: string) => number,
	text: string,
	maxWidth: number,
): string[] {
	const lines: string[] = []
	let line = ""
	for (const word of text.split(/\s+/)) {
		if (word === "") continue
		const next = line === "" ? word : `${line} ${word}`
		if (line !== "" && measure(next) > maxWidth) {
			lines.push(line)
			line = word
		} else line = next
	}
	if (line !== "") lines.push(line)
	return lines
}

/** `text` cut to `maxWidth` with an ellipsis (as it is when it fits). */
export function fitLine(
	measure: (text: string) => number,
	text: string,
	maxWidth: number,
	cut = false,
): string {
	if (!cut && measure(text) <= maxWidth) return text
	let line = `${text}…`
	while (measure(line) > maxWidth && line.length > 1) {
		line = `${line.slice(0, -2).trimEnd()}…`
	}
	return line
}

/** At most `max` lines; the last one ends in an ellipsis when text was cut. */
export function clampLines(
	measure: (text: string) => number,
	lines: string[],
	max: number,
	maxWidth: number,
): string[] {
	if (lines.length <= max) return lines
	const kept = lines.slice(0, max)
	kept[max - 1] = fitLine(measure, kept[max - 1], maxWidth, true)
	return kept
}

const font = (weight: number, px: number, style = "normal") =>
	`${style} ${weight} ${px}px ${POSTCARD_FONT}`

/** Paints the names that were on screen, at the picture's resolution, each with a dark halo. */
function drawLabels(
	ctx: CanvasRenderingContext2D,
	labels: readonly ShotLabel[],
	ratio: number,
	x0: number,
	y0: number,
): void {
	ctx.save()
	ctx.textBaseline = "middle"
	ctx.textAlign = "left"
	ctx.lineJoin = "round"
	for (const label of labels) {
		const size = label.fontSizePx * ratio
		ctx.font = `${label.fontStyle} ${label.fontWeight} ${size}px ${label.fontFamily}`
		const x = x0 + label.x * ratio
		const y = y0 + label.y * ratio
		ctx.globalAlpha = label.opacity
		// the screen's halo: a soft dark glow plus a thin dark outline
		ctx.shadowColor = "rgba(0, 0, 0, 0.9)"
		ctx.shadowBlur = size * 0.35
		ctx.strokeStyle = "rgba(0, 0, 0, 0.8)"
		ctx.lineWidth = size * 0.14
		ctx.strokeText(label.text, x, y)
		ctx.shadowBlur = 0
		ctx.fillStyle = label.color
		ctx.fillText(label.text, x, y)
	}
	ctx.restore()
}

/** The QR code with its white quiet zone, `size` px square. */
function drawQr(
	ctx: CanvasRenderingContext2D,
	modules: readonly (readonly boolean[])[],
	x: number,
	y: number,
	size: number,
): void {
	const count = modules.length
	const quiet = 2
	const cell = Math.floor(size / (count + 2 * quiet))
	const drawn = cell * (count + 2 * quiet)
	const left = Math.round(x + (size - drawn) / 2)
	const top = Math.round(y + (size - drawn) / 2)
	ctx.fillStyle = "#ffffff"
	ctx.beginPath()
	ctx.roundRect(left, top, drawn, drawn, cell)
	ctx.fill()
	ctx.fillStyle = "#0b0d12"
	for (let row = 0; row < count; row++) {
		for (let col = 0; col < count; col++) {
			if (modules[row][col]) {
				ctx.fillRect(
					left + (quiet + col) * cell,
					top + (quiet + row) * cell,
					cell,
					cell,
				)
			}
		}
	}
}

/**
 * Lays out (and with `paint`, paints) the stamp below the picture: returns its
 * height. Run once to measure and once to paint, so the card is cut to fit.
 */
function drawStamp(
	ctx: CanvasRenderingContext2D,
	text: PostcardText,
	options: PostcardOptions,
	u: number,
	x: number,
	top: number,
	width: number,
	columns: number,
	paint: boolean,
): number {
	const measure = (value: string) => ctx.measureText(value).width
	const qrSize = options.qr === null ? 0 : Math.round(5.4 * u)
	const textWidth = options.qr === null ? width : width - qrSize - 1.2 * u
	let y = top
	ctx.textBaseline = "alphabetic"
	ctx.textAlign = "left"

	const block = (
		value: string,
		weight: number,
		size: number,
		color: string,
		maxLines: number,
		lineHeight = 1.25,
		style = "normal",
	) => {
		ctx.font = font(weight, size, style)
		const lines = clampLines(
			measure,
			wrapText(measure, value, textWidth),
			maxLines,
			textWidth,
		)
		for (const line of lines) {
			y += size * lineHeight
			if (paint) {
				ctx.fillStyle = color
				ctx.fillText(line, x, y - size * (lineHeight - 1) - size * 0.05)
			}
		}
	}

	// the accent line: a postage-stamp orange
	if (paint) {
		ctx.fillStyle = "#f08c00"
		ctx.fillRect(x, y, 2.4 * u, Math.max(2, 0.14 * u))
	}
	y += 0.45 * u
	block(text.title, 700, 1.45 * u, "#ffffff", 2, 1.2)
	if (text.date !== null) {
		y += 0.2 * u
		block(text.date, 600, 0.8 * u, "#ffa94d", 1)
	}
	const caption = options.caption.trim()
	if (caption !== "") {
		y += 0.35 * u
		block(caption, 400, 0.95 * u, "#e9ecef", 3, 1.3)
	}

	if (text.rows.length > 0) {
		y += 0.7 * u
		const cellWidth = textWidth / columns
		const cellHeight = 2.3 * u
		text.rows.forEach((row, i) => {
			const cx = x + (i % columns) * cellWidth
			const cy = y + Math.floor(i / columns) * cellHeight
			if (!paint) return
			const dot = row.color === undefined ? 0 : 0.28 * u
			if (row.color !== undefined) {
				ctx.fillStyle = row.color
				ctx.beginPath()
				ctx.arc(cx + dot, cy + 0.55 * u, dot, 0, Math.PI * 2)
				ctx.fill()
			}
			const inner = cellWidth - 0.4 * u
			const labelX = cx + (dot === 0 ? 0 : 2.6 * dot)
			ctx.font = font(500, 0.68 * u)
			ctx.fillStyle = "#adb5bd"
			ctx.fillText(
				fitLine(measure, row.label, inner - (labelX - cx)),
				labelX,
				cy + 0.8 * u,
			)
			ctx.font = font(700, 0.82 * u)
			ctx.fillStyle = "#ffffff"
			ctx.fillText(fitLine(measure, row.value, inner), cx, cy + 1.75 * u)
		})
		y += Math.ceil(text.rows.length / columns) * cellHeight
	}
	if (text.note !== null) {
		y += 0.35 * u
		block(text.note, 400, 0.75 * u, "#ced4da", 3, 1.3)
	}
	if (text.scaleNote !== null) {
		y += 0.45 * u
		block(text.scaleNote, 400, 0.64 * u, "#909296", 2, 1.3, "italic")
	}
	y += 0.55 * u
	block(text.footer, 700, 0.7 * u, "#f08c00", 1)

	let bottom = y
	if (options.qr !== null) {
		const qx = x + width - qrSize
		if (paint) drawQr(ctx, options.qr, qx, top, qrSize)
		ctx.font = font(500, 0.55 * u)
		const lines = wrapText(measure, text.scan, qrSize + 0.6 * u)
		let qy = top + qrSize
		ctx.textAlign = "center"
		for (const line of lines) {
			qy += 0.55 * u * 1.3
			if (paint) {
				ctx.fillStyle = "#adb5bd"
				ctx.fillText(line, qx + qrSize / 2, qy)
			}
		}
		ctx.textAlign = "left"
		bottom = Math.max(bottom, qy)
	}
	return bottom - top
}

/** The whole postcard as a new canvas. */
export function drawPostcard(
	shot: SceneShot,
	text: PostcardText,
	options: PostcardOptions,
): HTMLCanvasElement {
	const { image } = shot
	const w = image.width
	const h = image.height
	const u = postcardUnit(w, h)
	const pad = Math.round(1.1 * u)
	const columns = rowColumns(w, h, text.rows.length)
	const canvas = document.createElement("canvas")
	canvas.width = w + 2 * pad
	canvas.height = 1
	let ctx = canvas.getContext("2d")
	if (ctx === null) return canvas

	const stampTop = pad + h + Math.round(1.1 * u)
	const stamp = drawStamp(
		ctx,
		text,
		options,
		u,
		pad,
		stampTop,
		w,
		columns,
		false,
	)
	canvas.height = Math.ceil(stampTop + stamp + pad)
	// resizing resets the context: fetch it afresh
	ctx = canvas.getContext("2d")
	if (ctx === null) return canvas

	const mount = ctx.createLinearGradient(0, 0, 0, canvas.height)
	mount.addColorStop(0, "#161c30")
	mount.addColorStop(1, "#07090f")
	ctx.fillStyle = mount
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	ctx.drawImage(image, pad, pad)
	if (options.names && shot.labels.length > 0) {
		ctx.save()
		ctx.beginPath()
		ctx.rect(pad, pad, w, h)
		ctx.clip()
		drawLabels(ctx, shot.labels, shot.ratio, pad, pad)
		ctx.restore()
	}
	ctx.strokeStyle = "rgba(255, 255, 255, 0.18)"
	ctx.lineWidth = Math.max(1, Math.round(u / 16))
	ctx.strokeRect(pad - 0.5, pad - 0.5, w + 1, h + 1)

	drawStamp(ctx, text, options, u, pad, stampTop, w, columns, true)
	return canvas
}

/** The canvas as a PNG. */
export const canvasToPng = (canvas: HTMLCanvasElement): Promise<Blob> =>
	new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob === null ? reject(new Error("no picture")) : resolve(blob),
			"image/png",
		)
	})
