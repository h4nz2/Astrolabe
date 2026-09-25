import sharp, { type TiffOptions } from "sharp"
import { describe, expect, it } from "vitest"

import {
	lzwDecode,
	pickPage,
	readTiffPage,
	readTiffPages,
	withJpegTables,
	type RangeReader,
} from "./tiff"

const W = 300
const H = 150

/** A test picture: smooth gradients plus a sharp-edged block, so misplaced tiles show. */
const picture = (channels: 1 | 3): Buffer => {
	const data = Buffer.alloc(W * H * channels)
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const block = x > 200 && y < 40 ? 200 : 0
			for (let c = 0; c < channels; c++) {
				data[(y * W + x) * channels + c] =
					(x * (c + 1) * 0.7 + y * 0.9 + block) & 255
			}
		}
	}
	return data
}

const reader =
	(file: Buffer): RangeReader =>
	(offset, length) =>
		Promise.resolve(new Uint8Array(file.subarray(offset, offset + length)))

const tiff = (channels: 1 | 3, options: TiffOptions): Promise<Buffer> =>
	sharp(picture(channels), { raw: { width: W, height: H, channels } })
		.toColourspace(channels === 1 ? "b-w" : "srgb")
		.tiff(options)
		.toBuffer()

const decodeJpeg = async (jpeg: Uint8Array) => {
	const { data, info } = await sharp(jpeg)
		.raw()
		.toBuffer({ resolveWithObject: true })
	return { data: new Uint8Array(data), channels: info.channels }
}

const maxDiff = (a: Uint8Array, b: Uint8Array): number => {
	let worst = 0
	for (let i = 0; i < a.length; i++)
		worst = Math.max(worst, Math.abs(a[i] - b[i]))
	return worst
}

describe("readTiffPage", () => {
	it.each([
		["uncompressed strips", 3, { compression: "none" }],
		[
			"LZW tiles",
			3,
			{ compression: "lzw", tile: true, tileWidth: 64, tileHeight: 64 },
		],
		[
			"LZW tiles with the horizontal predictor",
			1,
			{
				compression: "lzw",
				predictor: "horizontal",
				tile: true,
				tileWidth: 32,
				tileHeight: 32,
			},
		],
		["Deflate strips", 1, { compression: "deflate" }],
		["BigTIFF", 3, { compression: "lzw", bigtiff: true }],
	] as const)("reads %s exactly", async (_, channels, options) => {
		const file = await tiff(channels, options as TiffOptions)
		const pages = await readTiffPages(reader(file))
		expect(pages[0]).toMatchObject({ width: W, height: H })
		const raster = await readTiffPage(reader(file), pages[0])
		expect(raster).toMatchObject({ width: W, height: H, channels })
		expect(maxDiff(raster.data, picture(channels))).toBe(0)
	})

	it("reads JPEG tiles with shared tables", async () => {
		const file = await tiff(3, {
			compression: "jpeg",
			quality: 95,
			tile: true,
			tileWidth: 64,
			tileHeight: 64,
		})
		const pages = await readTiffPages(reader(file))
		const raster = await readTiffPage(reader(file), pages[0], decodeJpeg)
		const expected = picture(3)
		let sum = 0
		for (let i = 0; i < expected.length; i++)
			sum += Math.abs(raster.data[i] - expected[i])
		expect(sum / expected.length).toBeLessThan(4)
	})

	it("finds the overview pages of a pyramid and picks the smallest wide enough", async () => {
		const file = await tiff(1, {
			compression: "lzw",
			tile: true,
			tileWidth: 32,
			tileHeight: 32,
			pyramid: true,
		})
		const pages = await readTiffPages(reader(file))
		expect(pages.map((page) => page.width)).toEqual([300, 150, 75, 37, 18])
		expect(pickPage(pages, 70).width).toBe(75)
		expect(pickPage(pages, 1000).width).toBe(300)
		const small = await readTiffPage(reader(file), pickPage(pages, 70))
		expect(small).toMatchObject({ width: 75, channels: 1 })
		// the halved page still has the bright block top right
		expect(small.data[5 * 75 + 70]).toBeGreaterThan(small.data[5 * 75 + 20])
	})
})

describe("lzwDecode", () => {
	it("decodes the KwKwK case (a code defined by the code itself)", () => {
		// "aaaa" encodes as 97, 258, 97... with 9-bit codes: clear, a, (aa), a, EOI
		const codes = [256, 97, 258, 97, 257]
		const bits = codes.map((c) => c.toString(2).padStart(9, "0")).join("")
		const bytes = new Uint8Array(Math.ceil(bits.length / 8))
		for (let i = 0; i < bits.length; i++)
			if (bits[i] === "1") bytes[i >> 3] |= 128 >> (i & 7)
		expect([...lzwDecode(bytes, 4)]).toEqual([97, 97, 97, 97])
	})
})

describe("withJpegTables", () => {
	it("splices the tables before the tile's frame, dropping the extra markers", () => {
		const tables = Uint8Array.from([0xff, 0xd8, 1, 2, 0xff, 0xd9])
		const tile = Uint8Array.from([0xff, 0xd8, 3, 4, 0xff, 0xd9])
		expect([...withJpegTables(tile, tables)]).toEqual([
			0xff, 0xd8, 1, 2, 3, 4, 0xff, 0xd9,
		])
		expect(withJpegTables(tile, undefined)).toBe(tile)
	})
})
