/**
 * A minimal TIFF reader for the planet maps (`pnpm gen:surfaces`): reads one page of an 8-bit
 * TIFF through byte-range requests, so a 1 GB global mosaic's small overview (a few MB) is all
 * that is downloaded. Handles classic and BigTIFF, strips and tiles, chunky and planar samples,
 * no compression, LZW, Deflate and JPEG (the decoder is passed in), horizontal predictor,
 * grey, RGB, YCbCr-in-JPEG and palette images. Pure apart from the `RangeReader` it is given.
 */
import { inflateSync } from "node:zlib"

/** Reads `length` bytes at `offset` (an HTTP range request, or a slice of a local file). */
export type RangeReader = (
	offset: number,
	length: number,
) => Promise<Uint8Array>

/** Decodes a whole JPEG stream to interleaved 8-bit samples. */
export type JpegDecoder = (
	jpeg: Uint8Array,
) => Promise<{ data: Uint8Array; channels: number }>

export interface TiffPage {
	width: number
	height: number
	samplesPerPixel: number
	bitsPerSample: number
	compression: number
	photometric: number
	predictor: number
	/** 1 = chunky (RGBRGB), 2 = planar (RRR..GGG..BBB) */
	planar: number
	/** tile or strip size; a strip is a tile as wide as the image */
	tileWidth: number
	tileHeight: number
	offsets: number[]
	byteCounts: number[]
	/** 3 * 2^bits entries (all reds, then greens, then blues), 16-bit */
	colorMap?: number[]
	jpegTables?: Uint8Array
}

/** An 8-bit raster, interleaved. */
export interface Raster8 {
	width: number
	height: number
	channels: number
	data: Uint8Array
}

const TAG = {
	width: 256,
	height: 257,
	bitsPerSample: 258,
	compression: 259,
	photometric: 262,
	stripOffsets: 273,
	samplesPerPixel: 277,
	rowsPerStrip: 278,
	stripByteCounts: 279,
	planar: 284,
	predictor: 317,
	colorMap: 320,
	tileWidth: 322,
	tileLength: 323,
	tileOffsets: 324,
	tileByteCounts: 325,
	jpegTables: 347,
} as const

/** Byte size of one value of a TIFF field type. */
const TYPE_SIZE: Record<number, number> = {
	1: 1,
	2: 1,
	3: 2,
	4: 4,
	5: 8,
	6: 1,
	7: 1,
	8: 2,
	9: 4,
	10: 8,
	11: 4,
	12: 8,
	16: 8,
	17: 8,
	18: 8,
}

interface Reader {
	view: DataView
	little: boolean
}

const u16 = (r: Reader, at: number) => r.view.getUint16(at, r.little)
const u32 = (r: Reader, at: number) => r.view.getUint32(at, r.little)
const u64 = (r: Reader, at: number) => Number(r.view.getBigUint64(at, r.little))

const readValues = (r: Reader, at: number, type: number, count: number) => {
	const out: number[] = []
	for (let i = 0; i < count; i++) {
		const p = at + i * TYPE_SIZE[type]
		if (type === 3 || type === 8) out.push(u16(r, p))
		else if (type === 4 || type === 9) out.push(u32(r, p))
		else if (type === 16 || type === 17 || type === 18) out.push(u64(r, p))
		else out.push(r.view.getUint8(p))
	}
	return out
}

const toReader = (bytes: Uint8Array, little: boolean): Reader => ({
	view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
	little,
})

/** Every page (IFD) of the file, in order: the full image, then its overviews. */
export const readTiffPages = async (read: RangeReader): Promise<TiffPage[]> => {
	const head = await read(0, 16)
	const little = head[0] === 0x49
	const h = toReader(head, little)
	const big = u16(h, 2) === 43
	if (!big && u16(h, 2) !== 42) throw new Error("not a TIFF file")
	let next = big ? u64(h, 8) : u32(h, 4)
	const pages: TiffPage[] = []
	while (next !== 0 && pages.length < 64) {
		const countBytes = await read(next, big ? 8 : 2)
		const count = big
			? u64(toReader(countBytes, little), 0)
			: u16(toReader(countBytes, little), 0)
		const entrySize = big ? 20 : 12
		const body = await read(
			next + (big ? 8 : 2),
			count * entrySize + (big ? 8 : 4),
		)
		const r = toReader(body, little)
		const tags = new Map<number, number[] | Uint8Array>()
		for (let i = 0; i < count; i++) {
			const at = i * entrySize
			const tag = u16(r, at)
			const type = u16(r, at + 2)
			const n = big ? u64(r, at + 4) : u32(r, at + 4)
			const size = (TYPE_SIZE[type] ?? 1) * n
			const inline = size <= (big ? 8 : 4)
			const valueAt = at + (big ? 12 : 8)
			if (tag === TAG.jpegTables) {
				tags.set(
					tag,
					inline
						? body.slice(valueAt, valueAt + size)
						: await read(big ? u64(r, valueAt) : u32(r, valueAt), size),
				)
				continue
			}
			if (inline) {
				tags.set(tag, readValues(r, valueAt, type, n))
			} else {
				const offset = big ? u64(r, valueAt) : u32(r, valueAt)
				const bytes = await read(offset, size)
				tags.set(tag, readValues(toReader(bytes, little), 0, type, n))
			}
		}
		const num = (tag: number, fallback?: number): number => {
			const v = tags.get(tag)
			if (v === undefined || v instanceof Uint8Array) {
				if (fallback === undefined) throw new Error(`TIFF tag ${tag} missing`)
				return fallback
			}
			return v[0]
		}
		const list = (tag: number): number[] | undefined => {
			const v = tags.get(tag)
			return v === undefined || v instanceof Uint8Array ? undefined : v
		}
		const width = num(TAG.width)
		const height = num(TAG.height)
		const tiled = tags.has(TAG.tileWidth)
		const jpegTables = tags.get(TAG.jpegTables)
		pages.push({
			width,
			height,
			samplesPerPixel: num(TAG.samplesPerPixel, 1),
			bitsPerSample: num(TAG.bitsPerSample, 1),
			compression: num(TAG.compression, 1),
			photometric: num(TAG.photometric, 1),
			predictor: num(TAG.predictor, 1),
			planar: num(TAG.planar, 1),
			tileWidth: tiled ? num(TAG.tileWidth) : width,
			tileHeight: tiled ? num(TAG.tileLength) : num(TAG.rowsPerStrip, height),
			offsets: list(tiled ? TAG.tileOffsets : TAG.stripOffsets) ?? [],
			byteCounts: list(tiled ? TAG.tileByteCounts : TAG.stripByteCounts) ?? [],
			colorMap: list(TAG.colorMap),
			jpegTables: jpegTables instanceof Uint8Array ? jpegTables : undefined,
		})
		const tail = count * entrySize
		next = big ? u64(r, tail) : u32(r, tail)
	}
	return pages
}

/** The smallest page at least `minWidth` wide (the largest page if none is). */
export const pickPage = (pages: TiffPage[], minWidth: number): TiffPage => {
	const wide = pages
		.filter((page) => page.width >= minWidth)
		.sort((a, b) => a.width - b.width)
	return wide[0] ?? [...pages].sort((a, b) => b.width - a.width)[0]
}

/** TIFF LZW (MSB-first codes, 9 to 12 bits, early change). */
export const lzwDecode = (input: Uint8Array, expected: number): Uint8Array => {
	const out = new Uint8Array(expected)
	let outLength = 0
	const prefix = new Int32Array(4096)
	const suffix = new Uint8Array(4096)
	const lengths = new Int32Array(4096)
	for (let i = 0; i < 256; i++) {
		prefix[i] = -1
		suffix[i] = i
		lengths[i] = 1
	}
	let next = 258
	let width = 9
	let bitPos = 0
	let previous = -1
	const readCode = (): number => {
		let code = 0
		for (let i = 0; i < width; i++) {
			const byte = input[bitPos >> 3]
			if (byte === undefined) return 257
			code = (code << 1) | ((byte >> (7 - (bitPos & 7))) & 1)
			bitPos++
		}
		return code
	}
	const firstByte = (code: number): number => {
		let c = code
		while (prefix[c] !== -1) c = prefix[c]
		return suffix[c]
	}
	const emit = (code: number): void => {
		const length = lengths[code]
		let c = code
		for (let i = length - 1; i >= 0; i--) {
			if (outLength + i < expected) out[outLength + i] = suffix[c]
			c = prefix[c]
		}
		outLength += length
	}
	for (;;) {
		const code = readCode()
		if (code === 257) break
		if (code === 256) {
			next = 258
			width = 9
			previous = -1
			continue
		}
		if (previous === -1) {
			emit(code)
			previous = code
			continue
		}
		if (next >= 4096) {
			// a full table: the encoder must clear first; decode without adding
			emit(code)
			previous = code
			continue
		}
		prefix[next] = previous
		lengths[next] = lengths[previous] + 1
		if (code < next) {
			suffix[next] = firstByte(code)
			emit(code)
		} else {
			// KwKwK: the code being defined right now
			suffix[next] = firstByte(previous)
			emit(next)
		}
		next++
		previous = code
		if (next + 1 >= 1 << width && width < 12) width++
		if (outLength >= expected) break
	}
	return out
}

/** JPEG-in-TIFF: a tile's stream with the shared tables (tag 347) spliced in. */
export const withJpegTables = (
	tile: Uint8Array,
	tables: Uint8Array | undefined,
): Uint8Array => {
	if (tables === undefined || tables.length < 4) return tile
	const out = new Uint8Array(tables.length - 2 + tile.length - 2)
	out.set(tables.subarray(0, tables.length - 2), 0) // drop the tables' EOI
	out.set(tile.subarray(2), tables.length - 2) // drop the tile's SOI
	return out
}

/** Reads the chunks (tiles or strips) of a page, in as few requests as sensible. */
const readChunks = async (
	read: RangeReader,
	page: TiffPage,
): Promise<Uint8Array[]> => {
	const start = Math.min(...page.offsets)
	const end = Math.max(...page.offsets.map((o, i) => o + page.byteCounts[i]))
	const total = page.byteCounts.reduce((sum, n) => sum + n, 0)
	if (end - start <= total * 1.5 + 65536) {
		const all = await read(start, end - start)
		return page.offsets.map((o, i) =>
			all.subarray(o - start, o - start + page.byteCounts[i]),
		)
	}
	const chunks: Uint8Array[] = new Array<Uint8Array>(page.offsets.length)
	let cursor = 0
	const worker = async () => {
		while (cursor < page.offsets.length) {
			const i = cursor++
			chunks[i] = await read(page.offsets[i], page.byteCounts[i])
		}
	}
	await Promise.all(Array.from({ length: 8 }, worker))
	return chunks
}

/** Reads one page as an interleaved 8-bit raster (a palette image comes out as RGB). */
export const readTiffPage = async (
	read: RangeReader,
	page: TiffPage,
	decodeJpeg?: JpegDecoder,
): Promise<Raster8> => {
	if (page.bitsPerSample !== 8) {
		throw new Error(`TIFF: ${page.bitsPerSample}-bit samples are not supported`)
	}
	const { width, height, tileWidth, tileHeight } = page
	const planes = page.planar === 2 ? page.samplesPerPixel : 1
	const perChunk = page.planar === 2 ? 1 : page.samplesPerPixel
	const across = Math.ceil(width / tileWidth)
	const down = Math.ceil(height / tileHeight)
	const chunks = await readChunks(read, page)
	const samples = page.samplesPerPixel
	const raw = new Uint8Array(width * height * samples)
	for (let plane = 0; plane < planes; plane++) {
		for (let ty = 0; ty < down; ty++) {
			for (let tx = 0; tx < across; tx++) {
				const index = plane * across * down + ty * across + tx
				const chunk = chunks[index]
				const expected = tileWidth * tileHeight * perChunk
				let pixels: Uint8Array
				if (page.compression === 1) pixels = chunk
				else if (page.compression === 5) pixels = lzwDecode(chunk, expected)
				else if (page.compression === 8 || page.compression === 32946)
					pixels = new Uint8Array(inflateSync(chunk))
				else if (page.compression === 7) {
					if (decodeJpeg === undefined)
						throw new Error("TIFF: JPEG tiles need a decoder")
					pixels = (await decodeJpeg(withJpegTables(chunk, page.jpegTables)))
						.data
				} else {
					throw new Error(`TIFF: compression ${page.compression} not supported`)
				}
				if (page.predictor === 2) {
					for (let y = 0; y < tileHeight; y++) {
						const row = y * tileWidth * perChunk
						for (let x = perChunk; x < tileWidth * perChunk; x++) {
							pixels[row + x] =
								(pixels[row + x] + pixels[row + x - perChunk]) & 255
						}
					}
				}
				const x0 = tx * tileWidth
				const y0 = ty * tileHeight
				const w = Math.min(tileWidth, width - x0)
				const h = Math.min(tileHeight, height - y0)
				for (let y = 0; y < h; y++) {
					for (let x = 0; x < w; x++) {
						const from = (y * tileWidth + x) * perChunk
						const to = ((y0 + y) * width + x0 + x) * samples + plane
						for (let c = 0; c < perChunk; c++) raw[to + c] = pixels[from + c]
					}
				}
			}
		}
	}
	if (page.photometric === 3 && page.colorMap !== undefined) {
		const map = page.colorMap
		const n = map.length / 3
		const rgb = new Uint8Array(width * height * 3)
		for (let i = 0; i < width * height; i++) {
			const v = raw[i * samples]
			rgb[3 * i] = map[v] >> 8
			rgb[3 * i + 1] = map[n + v] >> 8
			rgb[3 * i + 2] = map[2 * n + v] >> 8
		}
		return { width, height, channels: 3, data: rgb }
	}
	// grey or RGB; an alpha or extra band is dropped
	const channels = samples >= 3 ? 3 : 1
	if (channels === samples) return { width, height, channels, data: raw }
	const out = new Uint8Array(width * height * channels)
	for (let i = 0; i < width * height; i++) {
		for (let c = 0; c < channels; c++)
			out[i * channels + c] = raw[i * samples + c]
	}
	return { width, height, channels, data: out }
}
