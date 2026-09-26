/**
 * Readers for the two science formats among the planet maps (`pnpm gen:surfaces`), pure:
 * - FITS (the Sun: SDO synoptic maps), a primary image of 8/16/32-bit integers or 32/64-bit
 *   floats, big-endian, first row at the bottom;
 * - ISIS 3 cubes (USGS mosaics), 8-bit, tiled or band-sequential.
 * Both give an equirectangular raster with north up.
 */

/** A single-band float raster, north up (row 0 is the northernmost). */
export interface FloatRaster {
	width: number
	height: number
	data: Float32Array
	/** true where the file says "no data" (BLANK, NaN) */
	blank: Uint8Array
}

const FITS_BLOCK = 2880

const latin1 = new TextDecoder("latin1")

/** The header cards of a FITS file (keyword -> raw value text, quotes and comments removed). */
export const fitsHeader = (
	bytes: Uint8Array,
): { cards: Map<string, string>; dataStart: number } => {
	const cards = new Map<string, string>()
	for (let at = 0; at + 80 <= bytes.length; at += 80) {
		const card = latin1.decode(bytes.subarray(at, at + 80))
		const key = card.slice(0, 8).trim()
		if (key === "END") {
			return {
				cards,
				dataStart: Math.ceil((at + 80) / FITS_BLOCK) * FITS_BLOCK,
			}
		}
		if (card[8] !== "=") continue
		let value = card.slice(10)
		const quoted = /^\s*'([^']*)'/.exec(value)
		value = quoted ? quoted[1].trim() : value.split("/")[0].trim()
		cards.set(key, value)
	}
	throw new Error("FITS: no END card")
}

/** The primary image of a FITS file, flipped so row 0 is the top (north). */
export const readFits = (bytes: Uint8Array): FloatRaster => {
	const { cards, dataStart } = fitsHeader(bytes)
	const num = (key: string, fallback?: number): number => {
		const v = cards.get(key)
		if (v === undefined) {
			if (fallback === undefined) throw new Error(`FITS: ${key} missing`)
			return fallback
		}
		return Number(v)
	}
	if (num("NAXIS") !== 2) throw new Error("FITS: expected a 2-D image")
	const bitpix = num("BITPIX")
	const width = num("NAXIS1")
	const height = num("NAXIS2")
	const scale = num("BSCALE", 1)
	const zero = num("BZERO", 0)
	const blankValue = cards.has("BLANK") ? num("BLANK") : null
	const size = Math.abs(bitpix) / 8
	const view = new DataView(bytes.buffer, bytes.byteOffset + dataStart)
	const data = new Float32Array(width * height)
	const blank = new Uint8Array(width * height)
	for (let row = 0; row < height; row++) {
		const y = height - 1 - row
		for (let x = 0; x < width; x++) {
			const at = (row * width + x) * size
			let v: number
			if (bitpix === -64) v = view.getFloat64(at, false)
			else if (bitpix === -32) v = view.getFloat32(at, false)
			else if (bitpix === 32) v = view.getInt32(at, false)
			else if (bitpix === 16) v = view.getInt16(at, false)
			else v = view.getUint8(at)
			const i = y * width + x
			// BLANK applies to integer data; float data marks gaps with NaN
			if (Number.isNaN(v) || (bitpix > 0 && v === blankValue)) {
				blank[i] = 1
				data[i] = 0
			} else {
				data[i] = zero + scale * v
			}
		}
	}
	return { width, height, data, blank }
}

/** An 8-bit raster from an ISIS cube, interleaved. */
export interface CubeRaster {
	width: number
	height: number
	channels: number
	data: Uint8Array
}

const labelValue = (label: string, key: string): string | undefined =>
	new RegExp(`^\\s*${key}\\s*=\\s*(\\S+)`, "m").exec(label)?.[1]

/** Reads an 8-bit ISIS 3 cube (the label is at the start of the file). */
export const readIsisCube = (bytes: Uint8Array): CubeRaster => {
	const label = latin1.decode(bytes.subarray(0, Math.min(bytes.length, 65536)))
	const core = label.slice(label.indexOf("Object = Core"))
	const get = (key: string): string => {
		const v = labelValue(core, key)
		if (v === undefined) throw new Error(`ISIS: ${key} missing`)
		return v
	}
	if (get("Type") !== "UnsignedByte") {
		throw new Error(`ISIS: ${get("Type")} pixels are not supported`)
	}
	const start = Number(get("StartByte")) - 1
	const width = Number(get("Samples"))
	const height = Number(get("Lines"))
	const bands = Number(get("Bands"))
	const tiled = get("Format") === "Tile"
	const tw = tiled ? Number(get("TileSamples")) : width
	const th = tiled ? Number(get("TileLines")) : height
	const across = Math.ceil(width / tw)
	const down = Math.ceil(height / th)
	const data = new Uint8Array(width * height * bands)
	let at = start
	for (let b = 0; b < bands; b++) {
		for (let ty = 0; ty < down; ty++) {
			for (let tx = 0; tx < across; tx++) {
				for (let y = 0; y < th; y++) {
					for (let x = 0; x < tw; x++) {
						const px = tx * tw + x
						const py = ty * th + y
						if (px < width && py < height) {
							data[(py * width + px) * bands + b] = bytes[at]
						}
						at++
					}
				}
			}
		}
	}
	return { width, height, channels: bands, data }
}
