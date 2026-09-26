import { describe, expect, it } from "vitest"

import { fitsHeader, readFits, readIsisCube } from "./formats"

const card = (text: string) => text.padEnd(80, " ")

/** A FITS file: header cards padded to 2880-byte blocks, then big-endian data. */
const fits = (
	cards: string[],
	values: number[],
	bitpix: -64 | -32 | 16,
): Uint8Array => {
	let header = [...cards, "END"].map(card).join("")
	header = header.padEnd(Math.ceil(header.length / 2880) * 2880, " ")
	const size = Math.abs(bitpix) / 8
	const data = new DataView(new ArrayBuffer(values.length * size))
	values.forEach((v, i) => {
		if (bitpix === -64) data.setFloat64(i * size, v, false)
		else if (bitpix === -32) data.setFloat32(i * size, v, false)
		else data.setInt16(i * size, v, false)
	})
	const out = new Uint8Array(header.length + data.byteLength)
	out.set(new TextEncoder().encode(header), 0)
	out.set(new Uint8Array(data.buffer), header.length)
	return out
}

describe("readFits", () => {
	it("reads the header cards, quoted strings and comments aside", () => {
		const file = fits(
			[
				"SIMPLE  =                    T / conforms",
				"BITPIX  =                  -64",
				"NAXIS   =                    2",
				"NAXIS1  =                    3",
				"NAXIS2  =                    2",
				"WAVELNTH= '304 = He II'",
			],
			[1, 2, 3, 4, 5, 6],
			-64,
		)
		const { cards, dataStart } = fitsHeader(file)
		expect(cards.get("WAVELNTH")).toBe("304 = He II")
		expect(cards.get("NAXIS1")).toBe("3")
		expect(dataStart).toBe(2880)
	})

	it("turns the image so north is up (FITS rows start at the bottom) and marks gaps", () => {
		const file = fits(
			[
				"SIMPLE  =                    T",
				"BITPIX  =                  -32",
				"NAXIS   =                    2",
				"NAXIS1  =                    2",
				"NAXIS2  =                    2",
				"BZERO   =                   10",
			],
			[1, Number.NaN, 3, 4],
			-32,
		)
		const image = readFits(file)
		expect(image).toMatchObject({ width: 2, height: 2 })
		// bottom row (1, NaN) comes last
		expect([...image.data]).toEqual([13, 14, 11, 0])
		expect([...image.blank]).toEqual([0, 0, 0, 1])
	})

	it("applies BSCALE and BLANK to integer data", () => {
		const file = fits(
			[
				"SIMPLE  =                    T",
				"BITPIX  =                   16",
				"NAXIS   =                    2",
				"NAXIS1  =                    2",
				"NAXIS2  =                    1",
				"BSCALE  =                  0.5",
				"BLANK   =                -1000",
			],
			[8, -1000],
			16,
		)
		const image = readFits(file)
		expect([...image.data]).toEqual([4, 0])
		expect([...image.blank]).toEqual([0, 1])
	})
})

describe("readIsisCube", () => {
	/** A 4 x 2 cube, 2 bands, stored in 2 x 2 tiles band by band, the label padded to 512 bytes. */
	const cube = (format: "Tile" | "BandSequential"): Uint8Array => {
		const label = [
			"Object = IsisCube",
			"  Object = Core",
			"    StartByte   = 513",
			`    Format      = ${format}`,
			"    TileSamples = 2",
			"    TileLines   = 2",
			"    Group = Dimensions",
			"      Samples = 4",
			"      Lines   = 2",
			"      Bands   = 2",
			"    End_Group",
			"    Group = Pixels",
			"      Type       = UnsignedByte",
			"    End_Group",
			"  End_Object",
			"End_Object",
			"",
		].join("\n")
		// pixel value = 10 * band + 4 * line + sample
		const value = (b: number, y: number, x: number) => 10 * b + 4 * y + x
		const body: number[] = []
		for (let b = 0; b < 2; b++) {
			if (format === "BandSequential") {
				for (let y = 0; y < 2; y++)
					for (let x = 0; x < 4; x++) body.push(value(b, y, x))
			} else {
				for (let tx = 0; tx < 2; tx++)
					for (let y = 0; y < 2; y++)
						for (let x = 0; x < 2; x++) body.push(value(b, y, 2 * tx + x))
			}
		}
		const out = new Uint8Array(512 + body.length)
		out.set(new TextEncoder().encode(label), 0)
		out.set(body, 512)
		return out
	}

	it.each(["Tile", "BandSequential"] as const)(
		"interleaves the bands of a %s cube",
		(format) => {
			const image = readIsisCube(cube(format))
			expect(image).toMatchObject({ width: 4, height: 2, channels: 2 })
			// pixel (x 3, y 1): band 0 = 7, band 1 = 17
			expect(image.data[(1 * 4 + 3) * 2]).toBe(7)
			expect(image.data[(1 * 4 + 3) * 2 + 1]).toBe(17)
			expect(image.data[0]).toBe(0)
			expect(image.data[1]).toBe(10)
		},
	)
})
