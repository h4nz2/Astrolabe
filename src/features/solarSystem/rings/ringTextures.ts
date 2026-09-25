/**
 * The GPU side of a ring system's strips (docs/ARCHITECTURE.md, "Rings").
 *
 * A ring's data is two radial strips (data/rings, `pnpm gen:rings`): face-on
 * opacity (gray level) and colour, u = 0 at the inner edge, 1 at the outer
 * edge. They are baked into two 1-texel-high textures with hand-built mip
 * chains, so any zoom shows the right thing:
 *
 * - `color`: RGB = the opacity-weighted mean colour (sRGB), A = the MEAN
 *   opacity over the texel's footprint. Averaging keeps what a patch of ring
 *   really looks like from afar, and weighting by opacity keeps the empty
 *   (black) space between Uranus's narrow rings from darkening their colour.
 * - `peak`: R = the HIGHEST opacity over the footprint. A ring a few km wide
 *   is far thinner than a pixel at any useful zoom; the mean alone would fade
 *   it away, the peak keeps it drawn as a thin line (legibility, the way
 *   photographs of Uranus's rings show them).
 *
 * The strips are read from the images once per ring system and cached, so the
 * planet (for its ring shadow) and the rings share one texture pair.
 */
import { use } from "react"
import {
	DataTexture,
	LinearFilter,
	LinearMipmapLinearFilter,
	RGBAFormat,
	SRGBColorSpace,
	UnsignedByteType,
	type Texture,
} from "three"

import type { Body } from "@/data"
import { assetUrl } from "@/utils/assetUrl"

export type RingData = NonNullable<Body["rings"]>

/** One mip level of a ring strip: `width` texels of opacity and linear RGB. */
export interface RingLevel {
	width: number
	/** mean face-on opacity, 0..1 */
	mean: Float32Array
	/** highest face-on opacity, 0..1 */
	peak: Float32Array
	/** opacity-weighted mean colour, linear RGB (3 per texel) */
	color: Float32Array
}

export interface RingTextures {
	/** RGB: colour (sRGB), A: mean opacity */
	color: Texture
	/** R: peak opacity */
	peak: Texture
}

export const srgbToLinear = (c: number): number =>
	c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
export const linearToSrgb = (c: number): number =>
	c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055

/**
 * Level 0 from the strips' bytes: `alpha` one gray value per texel, `rgb` three
 * sRGB bytes per texel (the same width).
 */
export function ringBaseLevel(
	alpha: ArrayLike<number>,
	rgb: ArrayLike<number>,
): RingLevel {
	const width = alpha.length
	if (rgb.length !== width * 3) {
		throw new Error(
			`ringBaseLevel: ${rgb.length} colour bytes for ${width} texels`,
		)
	}
	const mean = new Float32Array(width)
	const color = new Float32Array(width * 3)
	for (let x = 0; x < width; x++) {
		mean[x] = alpha[x] / 255
		for (let c = 0; c < 3; c++)
			color[x * 3 + c] = srgbToLinear(rgb[x * 3 + c] / 255)
	}
	return { width, mean, peak: mean.slice(), color }
}

/** The next level down: pairs of texels (the last one takes three when the width is odd). */
export function ringNextLevel(level: RingLevel): RingLevel {
	const width = Math.max(1, Math.floor(level.width / 2))
	const mean = new Float32Array(width)
	const peak = new Float32Array(width)
	const color = new Float32Array(width * 3)
	for (let x = 0; x < width; x++) {
		const from = x * 2
		const to = x === width - 1 ? level.width : Math.min(from + 2, level.width)
		let sum = 0
		let high = 0
		const rgb = [0, 0, 0]
		const plain = [0, 0, 0]
		for (let i = from; i < to; i++) {
			const a = level.mean[i]
			sum += a
			high = Math.max(high, level.peak[i])
			for (let c = 0; c < 3; c++) {
				rgb[c] += a * level.color[i * 3 + c]
				plain[c] += level.color[i * 3 + c]
			}
		}
		const n = to - from
		mean[x] = sum / n
		peak[x] = high
		for (let c = 0; c < 3; c++)
			color[x * 3 + c] = sum > 0 ? rgb[c] / sum : plain[c] / n
	}
	return { width, mean, peak, color }
}

/** Level 0 down to a single texel. */
export function ringMipChain(base: RingLevel): RingLevel[] {
	const levels = [base]
	while (levels[levels.length - 1].width > 1) {
		levels.push(ringNextLevel(levels[levels.length - 1]))
	}
	return levels
}

const toByte = (value: number): number =>
	Math.round(Math.min(Math.max(value, 0), 1) * 255)

const stripTexture = (
	levels: readonly RingLevel[],
	texel: (level: RingLevel, x: number, out: Uint8Array, o: number) => void,
): DataTexture => {
	const mipmaps = levels.map((level) => {
		const data = new Uint8Array(level.width * 4)
		for (let x = 0; x < level.width; x++) texel(level, x, data, x * 4)
		return { data, width: level.width, height: 1 }
	})
	const texture = new DataTexture(
		mipmaps[0].data,
		mipmaps[0].width,
		1,
		RGBAFormat,
		UnsignedByteType,
	)
	texture.mipmaps = mipmaps
	texture.generateMipmaps = false
	texture.minFilter = LinearMipmapLinearFilter
	texture.magFilter = LinearFilter
	texture.needsUpdate = true
	return texture
}

/** The two textures of a ring system from its mip chain. */
export function createRingTextures(levels: readonly RingLevel[]): RingTextures {
	const color = stripTexture(levels, (level, x, out, o) => {
		for (let c = 0; c < 3; c++)
			out[o + c] = toByte(linearToSrgb(level.color[x * 3 + c]))
		out[o + 3] = toByte(level.mean[x])
	})
	color.colorSpace = SRGBColorSpace
	const peak = stripTexture(levels, (level, x, out, o) => {
		out[o] = toByte(level.peak[x])
		out[o + 3] = 255
	})
	return { color, peak }
}

const loadImage = async (url: string): Promise<HTMLImageElement> => {
	const image = new Image()
	image.src = url
	await image.decode()
	return image
}

/**
 * The middle row of both strips at the opacity strip's width (the colour strip
 * is resampled to it if it differs), as bytes.
 */
const readStrips = (
	alphaImage: HTMLImageElement,
	colorImage: HTMLImageElement,
): { alpha: Uint8Array; rgb: Uint8Array } => {
	const width = alphaImage.naturalWidth
	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = 2
	const context = canvas.getContext("2d", { willReadFrequently: true })
	if (context === null) throw new Error("ring textures: no 2D canvas")
	context.imageSmoothingEnabled = true
	const row = (image: HTMLImageElement, y: number) =>
		context.drawImage(
			image,
			0,
			Math.floor(image.naturalHeight / 2),
			image.naturalWidth,
			1,
			0,
			y,
			width,
			1,
		)
	row(alphaImage, 0)
	row(colorImage, 1)
	const pixels = context.getImageData(0, 0, width, 2).data
	const alpha = new Uint8Array(width)
	const rgb = new Uint8Array(width * 3)
	for (let x = 0; x < width; x++) {
		// the opacity strip is gray: its level is the opacity (docs/ARCHITECTURE.md, "Rings")
		alpha[x] = pixels[x * 4]
		const o = (width + x) * 4
		rgb[x * 3] = pixels[o]
		rgb[x * 3 + 1] = pixels[o + 1]
		rgb[x * 3 + 2] = pixels[o + 2]
	}
	return { alpha, rgb }
}

const cache = new Map<string, Promise<RingTextures>>()

/** The baked textures of a ring system, loaded once and shared. */
export function loadRingTextures(rings: RingData): Promise<RingTextures> {
	const key = `${rings.textures.alpha}|${rings.textures.color}`
	let promise = cache.get(key)
	if (promise === undefined) {
		promise = Promise.all([
			loadImage(assetUrl(rings.textures.alpha)),
			loadImage(assetUrl(rings.textures.color)),
		]).then(([alphaImage, colorImage]) => {
			const { alpha, rgb } = readStrips(alphaImage, colorImage)
			return createRingTextures(ringMipChain(ringBaseLevel(alpha, rgb)))
		})
		cache.set(key, promise)
	}
	return promise
}

/** Suspends until the ring system's textures are ready; null for a body without rings. */
export function useRingTextures(rings: RingData | null): RingTextures | null {
	return rings === null ? null : use(loadRingTextures(rings))
}
