/**
 * A QR code as one SVG path (#29): the link to the current view, for a class
 * to scan off the projector. Encoding is `uqr` (tiny, no dependencies, loaded
 * with the share panel only); drawing is here, so the page renders it as
 * React SVG instead of injecting markup.
 */
import { encode } from "uqr"

export interface QrCode {
	/** Modules per side, the quiet zone included. */
	readonly size: number
	/** One SVG path of every dark module, in module units. */
	readonly path: string
}

/**
 * The dark modules of `modules` (rows of booleans, true = dark) as a path:
 * each horizontal run of dark modules is one rectangle.
 */
export function qrPath(modules: readonly (readonly boolean[])[]): string {
	const parts: string[] = []
	modules.forEach((row, y) => {
		let x = 0
		while (x < row.length) {
			if (!row[x]) {
				x += 1
				continue
			}
			const start = x
			while (x < row.length && row[x]) x += 1
			parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`)
		}
	})
	return parts.join("")
}

/** The QR code of `text`, medium error correction, with the standard four-module quiet zone. */
export function qrCode(text: string): QrCode {
	const { data, size } = encode(text, { ecc: "M", border: 4 })
	return { size, path: qrPath(data) }
}
