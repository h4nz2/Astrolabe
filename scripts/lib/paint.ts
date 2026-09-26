/**
 * Image arithmetic for the moon surfaces (#37), pure and unit-tested: painting a surface
 * from a recipe, completing a partial map, colouring a grey map and setting its brightness.
 * scripts/gen-moon-surfaces.ts does the file I/O around it.
 *
 * Every raster is an equirectangular map in the app's convention (docs/ARCHITECTURE.md,
 * "Rotation"): x = 0 is longitude -180 deg, the centre column is the prime meridian, east is
 * to the right, north up. Values are sRGB-encoded in 0..1.
 */
import type { Recipe } from "./surfaces"

/** A single-channel raster (row-major). */
export interface Gray {
	width: number
	height: number
	data: Float32Array
}

/** An RGB raster (row-major, interleaved). */
export interface Rgb {
	width: number
	height: number
	data: Float32Array
}

/** Deterministic PRNG (mulberry32): the same seed paints the same moon on every machine. */
export const mulberry32 = (seed: number): (() => number) => {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export const hexToRgb = (hex: string): [number, number, number] => {
	const n = Number.parseInt(hex.slice(1), 16)
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

const to255 = (v: number): number =>
	Math.max(0, Math.min(255, Math.round(v * 255)))

export const rgbToHex = (r: number, g: number, b: number): string =>
	`#${[r, g, b].map((v) => to255(v).toString(16).padStart(2, "0")).join("")}`

/** Rec. 709 luma of an sRGB triple (good enough to compare brightness). */
export const luma = (r: number, g: number, b: number): number =>
	0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * The drawn mean brightness (sRGB 0..1) of a surface with this geometric albedo. Compressed so
 * the darkest moons (albedo 0.04) stay visible on a projector while the ordering holds: coal-dark
 * Phoebe below grey Umbriel below bright Ariel below snow-white Enceladus.
 */
export const albedoToLevel = (albedo: number): number =>
	0.14 + 0.64 * Math.min(1, albedo) ** 0.6

/**
 * Soft highlight roll-off (sRGB 0..1): values above `KNEE` approach 1 smoothly instead of
 * clipping, so the brightest ice keeps its craters.
 */
const KNEE = 0.72
export const softClip = (v: number): number =>
	v <= KNEE
		? Math.max(0, v)
		: KNEE + (1 - KNEE) * (1 - Math.exp(-(v - KNEE) / (1 - KNEE)))

/** Longitude and latitude (radians) of a pixel centre. */
export const pixelLonLat = (
	x: number,
	y: number,
	width: number,
	height: number,
): [number, number] => [
	((x + 0.5) / width) * 2 * Math.PI - Math.PI,
	Math.PI / 2 - ((y + 0.5) / height) * Math.PI,
]

/** Area weight of a row (cos of its latitude): equirectangular rows near the poles cover less. */
const rowWeight = (y: number, height: number): number =>
	Math.cos(pixelLonLat(0, y, 1, height)[1])

/** Area-weighted mean of a grey raster, over `mask` when given. */
export const areaMean = (gray: Gray, mask?: Uint8Array): number => {
	const { width, height, data } = gray
	let sum = 0
	let weight = 0
	for (let y = 0; y < height; y++) {
		const w = rowWeight(y, height)
		for (let x = 0; x < width; x++) {
			const i = y * width + x
			if (mask !== undefined && mask[i] === 0) continue
			sum += data[i] * w
			weight += w
		}
	}
	return weight === 0 ? 0 : sum / weight
}

/** Area-weighted mean colour of an RGB raster. */
export const meanColor = (rgb: Rgb): [number, number, number] => {
	const { width, height, data } = rgb
	const sum = [0, 0, 0]
	let weight = 0
	for (let y = 0; y < height; y++) {
		const w = rowWeight(y, height)
		for (let x = 0; x < width; x++) {
			const i = 3 * (y * width + x)
			sum[0] += data[i] * w
			sum[1] += data[i + 1] * w
			sum[2] += data[i + 2] * w
			weight += w
		}
	}
	return [sum[0] / weight, sum[1] / weight, sum[2] / weight]
}

/** Rolls a raster by half its width: a map centred on 180 deg becomes one centred on 0 deg. */
export const rollHalf = <T extends Gray | Rgb>(
	raster: T,
	channels: 1 | 3,
): T => {
	const { width, height, data } = raster
	const out = new Float32Array(data.length)
	const half = width / 2
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const from = (y * width + ((x + half) % width)) * channels
			const to = (y * width + x) * channels
			for (let c = 0; c < channels; c++) out[to + c] = data[from + c]
		}
	}
	return { ...raster, data: out }
}

// ---------------------------------------------------------------------------------------------
// noise

const hash3 = (x: number, y: number, z: number, seed: number): number => {
	let h = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)
	h ^= Math.imul(z, 0x1b873593)
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const fade = (t: number): number => t * t * (3 - 2 * t)

/** 3D value noise in 0..1, seamless on the sphere because it is sampled in 3D. */
export const valueNoise = (
	x: number,
	y: number,
	z: number,
	seed: number,
): number => {
	const xi = Math.floor(x)
	const yi = Math.floor(y)
	const zi = Math.floor(z)
	const u = fade(x - xi)
	const v = fade(y - yi)
	const w = fade(z - zi)
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t
	const c = (dx: number, dy: number, dz: number) =>
		hash3(xi + dx, yi + dy, zi + dz, seed)
	return lerp(
		lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
		lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
		w,
	)
}

/** Fractal sum of `octaves` value noises, 0..1 (mean about 0.5). */
export const fbm = (
	x: number,
	y: number,
	z: number,
	seed: number,
	octaves: number,
): number => {
	let sum = 0
	let amp = 0.5
	let norm = 0
	let f = 1
	for (let o = 0; o < octaves; o++) {
		sum += amp * valueNoise(x * f, y * f, z * f, seed + o * 1013)
		norm += amp
		amp *= 0.5
		f *= 2.03
	}
	return sum / norm
}

// ---------------------------------------------------------------------------------------------
// painting

interface Crater {
	lon: number
	lat: number
	x: number
	y: number
	z: number
	/** angular radius (rad) */
	r: number
	floor: number
	rim: number
	halo: number
}

/** How far a crater's rim and ejecta reach, in crater radii. */
const CRATER_REACH = 2.5

const smoothstep = (e0: number, e1: number, x: number): number => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
	return t * t * (3 - 2 * t)
}

const randomCraters = (
	rng: () => number,
	count: number,
	rMin: number,
	rMax: number,
	strength: number,
): Crater[] => {
	const craters: Crater[] = []
	const q = (rMin / rMax) ** 2
	for (let i = 0; i < count; i++) {
		// uniform on the sphere
		const z = 2 * rng() - 1
		const lon = 2 * Math.PI * rng() - Math.PI
		const lat = Math.asin(z)
		// cumulative size distribution N(>r) ~ r^-2, as on real cratered surfaces
		const r = rMin / Math.sqrt(1 - rng() * (1 - q))
		const fresh = rng() < 0.15
		// older craters are softened; a few floors are brighter (ice, or dark rim material)
		const age = 0.25 + 0.75 * rng() ** 1.5
		const floorSign = rng() < 0.2 ? -0.5 : 1
		craters.push({
			lon,
			lat,
			x: Math.cos(lat) * Math.cos(lon),
			y: z,
			z: Math.cos(lat) * Math.sin(lon),
			r,
			floor: -0.16 * age * strength * floorSign,
			rim: 0.08 * age * strength,
			halo: fresh ? 0.14 * strength : 0,
		})
	}
	return craters
}

/** Adds one crater's brightness to the raster, visiting only the pixels it reaches. */
const stampCrater = (data: Float32Array, width: number, c: Crater): void => {
	const height = width / 2
	const reach = CRATER_REACH * c.r
	const rowOf = (lat: number) => ((Math.PI / 2 - lat) / Math.PI) * height - 0.5
	const y0 = Math.max(
		0,
		Math.floor(rowOf(Math.min(Math.PI / 2, c.lat + reach))),
	)
	const y1 = Math.min(
		height - 1,
		Math.ceil(rowOf(Math.max(-Math.PI / 2, c.lat - reach))),
	)
	for (let y = y0; y <= y1; y++) {
		const lat = Math.PI / 2 - ((y + 0.5) / height) * Math.PI
		const cosLat = Math.cos(lat)
		const span =
			cosLat < 1e-6 || reach / cosLat >= Math.PI
				? Math.PI
				: Math.asin(Math.min(1, Math.sin(reach) / cosLat))
		const halfCols = Math.min(
			width / 2,
			Math.ceil((span / (2 * Math.PI)) * width) + 1,
		)
		const centre = Math.round(((c.lon + Math.PI) / (2 * Math.PI)) * width - 0.5)
		const py = Math.sin(lat)
		for (let dx = -halfCols; dx <= halfCols; dx++) {
			const x = (((centre + dx) % width) + width) % width
			const lon = ((x + 0.5) / width) * 2 * Math.PI - Math.PI
			const dot =
				cosLat * Math.cos(lon) * c.x + py * c.y + cosLat * Math.sin(lon) * c.z
			const d = Math.acos(Math.min(1, dot)) / c.r
			if (d >= CRATER_REACH) continue
			let v = 0
			if (d < 1) v += c.floor * (1 - d * d)
			v += c.rim * Math.exp(-(((d - 1) / 0.18) ** 2))
			if (c.halo > 0 && d > 0.8)
				v += c.halo * (1 - smoothstep(0.9, CRATER_REACH, d))
			data[y * width + x] += v
		}
	}
}

/**
 * A painted surface's relative brightness (mean about 1) from its recipe. `seed` makes each
 * moon its own: two moons of one family share colour and kind of terrain but never the map.
 */
export const paintLuminance = (
	recipe: Pick<Recipe, "pattern" | "craters">,
	seed: number,
	width: number,
): Gray => {
	const height = width / 2
	const data = new Float32Array(width * height)
	const rng = mulberry32(seed)
	const pixel = (2 * Math.PI) / width
	const density = recipe.craters ?? 1
	const craters =
		recipe.pattern === "cratered"
			? randomCraters(rng, Math.round(1400 * density), 2.5 * pixel, 0.45, 1)
			: recipe.pattern === "smooth"
				? randomCraters(rng, Math.round(120 * density), 4 * pixel, 0.3, 0.35)
				: []
	const noiseSeed = Math.floor(rng() * 1e9)
	const scale = 1.4 + rng() * 1.2
	const bandPhase = rng() * Math.PI * 2
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const [lon, lat] = pixelLonLat(x, y, width, height)
			const px = Math.cos(lat) * Math.cos(lon)
			const py = Math.sin(lat)
			const pz = Math.cos(lat) * Math.sin(lon)
			let v: number
			if (recipe.pattern === "haze") {
				// Titan: a smooth haze, the northern hemisphere a little darker, faint bands
				v =
					1 -
					0.07 * Math.sin(lat) +
					0.025 * Math.sin(lat * 7 + bandPhase) +
					0.02 * (fbm(px * 2, py * 6, pz * 2, noiseSeed, 3) - 0.5)
			} else {
				// broad albedo patches (darker and brighter terrains) and a fine mottling
				const broad = fbm(px * scale, py * scale, pz * scale, noiseSeed, 5)
				const fine = fbm(px * 12, py * 12, pz * 12, noiseSeed + 7, 3)
				const amount = recipe.pattern === "smooth" ? 0.2 : 0.55
				v = 1 + amount * (broad - 0.5) + 0.16 * (fine - 0.5)
			}
			data[y * width + x] = v
		}
	}
	for (const crater of craters) stampCrater(data, width, crater)
	for (let i = 0; i < data.length; i++) data[i] = Math.max(0.05, data[i])
	// rims and ejecta brighten on balance: back to a mean of 1, so the albedo alone sets the level
	return relative({ width, height, data })
}

/**
 * Colours a relative-brightness raster (mean about 1): bright parts take `hue`, dark parts shade
 * into `darkHue`, and the whole is scaled so its mean brightness is `level`. Only the hues'
 * colour matters, not their own brightness.
 */
export const colourize = (
	lum: Gray,
	hue: string,
	darkHue: string | undefined,
	level: number,
): Rgb => {
	const bright = hexToRgb(hue)
	const dark = hexToRgb(darkHue ?? hue)
	const nb = luma(...bright)
	const nd = luma(...dark)
	const { width, height } = lum
	const out = new Float32Array(width * height * 3)
	for (let i = 0; i < width * height; i++) {
		const v = lum.data[i]
		const t = smoothstep(0.55, 1.15, v)
		const s = level * v
		for (let c = 0; c < 3; c++) {
			const tone = (1 - t) * (dark[c] / nd) + t * (bright[c] / nb)
			out[3 * i + c] = softClip(s * tone)
		}
	}
	return { width, height, data: out }
}

/**
 * A colour map with `keep` of its colour (0 grey .. 1 as published), scaled so its mean
 * brightness is `level`.
 */
export const adjustColour = (rgb: Rgb, keep: number, level: number): Rgb => {
	const { width, height, data } = rgb
	const lum: Gray = { width, height, data: new Float32Array(width * height) }
	for (let i = 0; i < width * height; i++) {
		lum.data[i] = luma(data[3 * i], data[3 * i + 1], data[3 * i + 2])
	}
	const gain = level / Math.max(1e-6, areaMean(lum))
	const out = new Float32Array(data.length)
	for (let i = 0; i < width * height; i++) {
		const y = lum.data[i]
		for (let c = 0; c < 3; c++) {
			const v = y + keep * (data[3 * i + c] - y)
			out[3 * i + c] = softClip(v * gain)
		}
	}
	return { width, height, data: out }
}

/** Divides a grey raster by its area-weighted mean over `mask`: mean 1, contrast kept. */
export const relative = (gray: Gray, mask?: Uint8Array): Gray => {
	const mean = Math.max(1e-6, areaMean(gray, mask))
	return { ...gray, data: gray.data.map((v) => v / mean) }
}

// ---------------------------------------------------------------------------------------------
// completing a partial map

/** Separable box blur, repeated three times (about a Gaussian); wraps in x, clamps in y. */
export const blur = (gray: Gray, radius: number): Gray => {
	const { width, height } = gray
	const src = Float32Array.from(gray.data)
	const tmp = new Float32Array(src.length)
	const r = Math.max(1, Math.round(radius))
	const n = 2 * r + 1
	for (let pass = 0; pass < 3; pass++) {
		for (let y = 0; y < height; y++) {
			let sum = 0
			for (let k = -r; k <= r; k++)
				sum += src[y * width + ((k + width) % width)]
			for (let x = 0; x < width; x++) {
				tmp[y * width + x] = sum / n
				sum +=
					src[y * width + ((x + r + 1) % width)] -
					src[y * width + ((x - r + width) % width)]
			}
		}
		const clampY = (y: number) => Math.min(height - 1, Math.max(0, y))
		for (let x = 0; x < width; x++) {
			let sum = 0
			for (let k = -r; k <= r; k++) sum += tmp[clampY(k) * width + x]
			for (let y = 0; y < height; y++) {
				src[y * width + x] = sum / n
				sum +=
					tmp[clampY(y + r + 1) * width + x] - tmp[clampY(y - r) * width + x]
			}
		}
	}
	return { width, height, data: src }
}

/** Shrinks a mask by `radius` pixels (a pixel stays only if its whole neighbourhood is set). */
export const erode = (
	mask: Uint8Array,
	width: number,
	height: number,
	radius: number,
): Uint8Array => {
	// a square neighbourhood is separable: rows first, then columns
	const rows = new Uint8Array(mask.length)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let keep = 1
			for (let dx = -radius; dx <= radius; dx++) {
				if (mask[y * width + ((x + dx + width) % width)] === 0) {
					keep = 0
					break
				}
			}
			rows[y * width + x] = keep
		}
	}
	const out = new Uint8Array(mask.length)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let keep = 1
			for (let dy = -radius; dy <= radius; dy++) {
				const yy = Math.min(height - 1, Math.max(0, y + dy))
				if (rows[yy * width + x] === 0) {
					keep = 0
					break
				}
			}
			out[y * width + x] = keep
		}
	}
	return out
}

/**
 * Push-pull interpolation: the valid values where `mask` is set, and everywhere else a smooth
 * continuation of them (each coarser level fills the holes of the finer one).
 */
export const pushPull = (gray: Gray, mask: Uint8Array): Gray => {
	const levels: { w: number; h: number; a: Float32Array; m: Float32Array }[] =
		[]
	let w = gray.width
	let h = gray.height
	let a = new Float32Array(w * h)
	let m = new Float32Array(w * h)
	for (let i = 0; i < w * h; i++) {
		m[i] = mask[i]
		a[i] = gray.data[i] * mask[i]
	}
	levels.push({ w, h, a, m })
	while (w > 1 || h > 1) {
		const nw = Math.max(1, w >> 1)
		const nh = Math.max(1, h >> 1)
		const na = new Float32Array(nw * nh)
		const nm = new Float32Array(nw * nh)
		for (let y = 0; y < nh; y++) {
			for (let x = 0; x < nw; x++) {
				let sa = 0
				let sm = 0
				let n = 0
				for (let dy = 0; dy < 2; dy++) {
					for (let dx = 0; dx < 2; dx++) {
						const xx = Math.min(w - 1, 2 * x + dx)
						const yy = Math.min(h - 1, 2 * y + dy)
						sa += a[yy * w + xx]
						sm += m[yy * w + xx]
						n++
					}
				}
				na[y * nw + x] = sa / n
				nm[y * nw + x] = sm / n
			}
		}
		w = nw
		h = nh
		a = na
		m = nm
		levels.push({ w, h, a, m })
	}
	const top = levels[levels.length - 1]
	let filled = new Float32Array([top.m[0] > 0 ? top.a[0] / top.m[0] : 0])
	for (let k = levels.length - 2; k >= 0; k--) {
		const { w: lw, h: lh, a: la, m: lm } = levels[k]
		const coarse = levels[k + 1]
		const next = new Float32Array(lw * lh)
		for (let y = 0; y < lh; y++) {
			for (let x = 0; x < lw; x++) {
				const cx = Math.min(coarse.w - 1, x >> 1)
				const cy = Math.min(coarse.h - 1, y >> 1)
				const up = filled[cy * coarse.w + cx]
				const i = y * lw + x
				next[i] = lm[i] >= 1 ? la[i] / lm[i] : la[i] + (1 - lm[i]) * up
			}
		}
		filled = next
	}
	return { width: gray.width, height: gray.height, data: filled }
}

/** Longitude turns tried when borrowing terrain, in order. */
const BORROW_SHIFTS_DEG = [180, 90, 270, 0, 135, 225, 45, 315]
/** Latitude steps (towards the south, then the north) tried after the first borrow point. */
const BORROW_LAT_STEPS_DEG = [0, -10, -20, -30, -45, -60, 10, 20, 30, 45, 60]

/**
 * First latitude (deg) to borrow terrain from for an unimaged point at `lat`: the other
 * hemisphere well away from the mirror point (a plain mirror would draw a visible symmetry line
 * along the equator), or further south for a gap in the south. The spacecraft that left these
 * gaps (Voyager 2 at Uranus) saw the south, so that is where to look first.
 */
const borrowLatitude = (lat: number): number =>
	lat >= 0 ? -(25 + 0.7 * lat) : Math.max(-88, lat - 30)

/**
 * Completes a partial map (Voyager 2 saw only the southern halves of Uranus's moons): the holes
 * get the smooth brightness of the surrounding terrain (push-pull, blurred) plus the fine detail
 * of the opposite hemisphere, borrowed from the first shifted mirror point that was imaged.
 * The result looks like the same world without a seam, and without inventing features that a
 * reader could mistake for mapped ones (the app says which half is filled in).
 */
export const fillGaps = (gray: Gray, valid: Uint8Array): Gray => {
	const { width, height } = gray
	// the edge of an imaged area is smeared and outlined in the sources: drop a margin
	const mask = erode(valid, width, height, Math.max(1, Math.round(width / 96)))
	const smooth = pushPull(gray, mask)
	const low = blur(smooth, width / 96)
	const out = new Float32Array(width * height)
	const rowOf = (lat: number) =>
		Math.min(
			height - 1,
			Math.max(0, Math.round(((90 - lat) / 180) * height - 0.5)),
		)
	for (let y = 0; y < height; y++) {
		const lat = 90 - ((y + 0.5) / height) * 180
		const start = borrowLatitude(lat)
		for (let x = 0; x < width; x++) {
			const i = y * width + x
			if (mask[i] === 1) {
				out[i] = gray.data[i]
				continue
			}
			let detail = 0
			search: for (const step of BORROW_LAT_STEPS_DEG) {
				const yy = rowOf(Math.max(-89, Math.min(89, start + step)))
				for (const shift of BORROW_SHIFTS_DEG) {
					const xx = (x + Math.round((shift / 360) * width)) % width
					const j = yy * width + xx
					if (mask[j] === 1) {
						detail = gray.data[j] - low.data[j]
						break search
					}
				}
			}
			out[i] = low.data[i] + 0.85 * detail
		}
	}
	// next to the imaged area the borrowed detail fades in, so the edge leaves no seam
	const soft = blur(
		{ width, height, data: Float32Array.from(mask) },
		width / 256,
	)
	for (let i = 0; i < width * height; i++) {
		if (mask[i] === 1) continue
		const k = Math.min(1, 2 * soft.data[i])
		out[i] = k * smooth.data[i] + (1 - k) * out[i]
	}
	return { width, height, data: out }
}

/** Pearson correlation of two equally sized rasters (1 = the same pattern). */
export const correlation = (a: Float32Array, b: Float32Array): number => {
	let ma = 0
	let mb = 0
	for (let i = 0; i < a.length; i++) {
		ma += a[i]
		mb += b[i]
	}
	ma /= a.length
	mb /= b.length
	let sab = 0
	let saa = 0
	let sbb = 0
	for (let i = 0; i < a.length; i++) {
		const da = a[i] - ma
		const db = b[i] - mb
		sab += da * db
		saa += da * da
		sbb += db * db
	}
	return sab / Math.sqrt(saa * sbb)
}

// ---------------------------------------------------------------------------------------------
// painted cloud bands (the Sun's and planets' textures)

/** An oval painted over the bands: a storm, a dark spot, a bright cloud (degrees). */
export interface Spot {
	lat: number
	lon: number
	/** half-width in longitude and half-height in latitude, degrees */
	width: number
	height: number
	colour: string
	/** how much of the spot's colour covers the bands at its centre, 0..1 */
	opacity: number
}

/** A giant planet's cloud tops painted from a latitude profile. */
export interface BandedRecipe {
	/** colour stops [planetographic latitude in degrees, "#rrggbb"], from north to south */
	bands: [number, string][]
	/** how much the bands wave and mottle: 0 calm (Uranus) .. 1 stormy (Saturn's belts) */
	turbulence: number
	spots?: Spot[]
}

/** The profile as a function of latitude (degrees): linear between stops, flat beyond the ends. */
export const bandProfile = (
	bands: [number, string][],
): ((lat: number) => [number, number, number]) => {
	const stops = bands.map(([at, hex]) => ({ at, rgb: hexToRgb(hex) }))
	return (lat) => {
		if (lat >= stops[0].at) return stops[0].rgb
		for (let i = 1; i < stops.length; i++) {
			const a = stops[i - 1]
			const b = stops[i]
			if (lat >= b.at) {
				const t = a.at === b.at ? 0 : (a.at - lat) / (a.at - b.at)
				return [0, 1, 2].map((c) => a.rgb[c] + t * (b.rgb[c] - a.rgb[c])) as [
					number,
					number,
					number,
				]
			}
		}
		return stops[stops.length - 1].rgb
	}
}

/**
 * Cloud bands from a latitude profile: each pixel takes the profile's colour at a latitude
 * nudged by zonal turbulence (stretched along the bands, the way jet streams draw them), with
 * a fine mottling on top, then the spots. `seed` fixes the turbulence.
 */
export const paintBands = (
	recipe: BandedRecipe,
	seed: number,
	width: number,
): Rgb => {
	const height = width / 2
	const out = new Float32Array(width * height * 3)
	const { turbulence } = recipe
	const colourAt = bandProfile(recipe.bands)
	const spots = (recipe.spots ?? []).map((spot) => ({
		...spot,
		rgb: hexToRgb(spot.colour),
	}))
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const [lon, lat] = pixelLonLat(x, y, width, height)
			const px = Math.cos(lat) * Math.cos(lon)
			const py = Math.sin(lat)
			const pz = Math.cos(lat) * Math.sin(lon)
			// zonal: slow along longitude, quick across latitude
			const wave = fbm(px * 1.6, py * 14, pz * 1.6, seed, 5) - 0.5
			const eddy = fbm(px * 5, py * 30, pz * 5, seed + 17, 4) - 0.5
			const latDeg =
				(lat * 180) / Math.PI + turbulence * (6 * wave + 2.5 * eddy)
			const [r, g, b] = colourAt(latDeg)
			const mottle =
				1 +
				turbulence * 0.08 * (fbm(px * 9, py * 40, pz * 9, seed + 31, 3) - 0.5)
			let rgb = [r * mottle, g * mottle, b * mottle]
			const lonDeg = (lon * 180) / Math.PI
			for (const spot of spots) {
				const dLon = ((((lonDeg - spot.lon) % 360) + 540) % 360) - 180
				const d = Math.hypot(
					dLon / spot.width,
					((lat * 180) / Math.PI - spot.lat) / spot.height,
				)
				if (d >= 1) continue
				const k = spot.opacity * (1 - smoothstep(0.45, 1, d))
				rgb = rgb.map((v, c) => v + k * (spot.rgb[c] - v))
			}
			// the stops are authored colours: kept as they are, only clamped
			const i = 3 * (y * width + x)
			for (let c = 0; c < 3; c++) out[i + c] = Math.min(1, Math.max(0, rgb[c]))
		}
	}
	return { width, height, data: out }
}

/**
 * A grey map's values raised to `power` (under 1 compresses a huge range, like the Sun's
 * bright active regions against its quiet surface), then made relative (mean 1).
 */
export const stretch = (gray: Gray, power: number, mask?: Uint8Array): Gray =>
	relative(
		{
			...gray,
			data: gray.data.map((v) => Math.max(0, v) ** power),
		},
		mask,
	)

/**
 * A grey raster resampled to `width` x `height` (each output pixel averages 3 x 3 bilinear
 * samples over its footprint, enough for the gentle shrinking the sources need). Wraps in x.
 */
export const resample = (gray: Gray, width: number, height: number): Gray => {
	const src = gray
	const sample = (fx: number, fy: number): number => {
		const x = fx - 0.5
		const y = Math.min(src.height - 1, Math.max(0, fy - 0.5))
		const x0 = Math.floor(x)
		const y0 = Math.floor(y)
		const tx = x - x0
		const ty = y - y0
		const y1 = Math.min(src.height - 1, y0 + 1)
		const at = (xx: number, yy: number) =>
			src.data[yy * src.width + (((xx % src.width) + src.width) % src.width)]
		return (
			(1 - ty) * ((1 - tx) * at(x0, y0) + tx * at(x0 + 1, y0)) +
			ty * ((1 - tx) * at(x0, y1) + tx * at(x0 + 1, y1))
		)
	}
	const sx = src.width / width
	const sy = src.height / height
	const data = new Float32Array(width * height)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let sum = 0
			for (let j = 0; j < 3; j++) {
				for (let i = 0; i < 3; i++) {
					sum += sample((x + (i + 0.5) / 3) * sx, (y + (j + 0.5) / 3) * sy)
				}
			}
			data[y * width + x] = sum / 9
		}
	}
	return { width, height, data }
}

/**
 * Blends a map's left and right edges into each other over `columns` columns, so a map made
 * over time (the Sun's synoptic maps, built over a 27-day rotation) closes without a seam.
 */
export const closeSeam = <T extends Gray | Rgb>(
	raster: T,
	channels: 1 | 3,
	columns: number,
): T => {
	const { width, height } = raster
	const data = Float32Array.from(raster.data)
	for (let y = 0; y < height; y++) {
		for (let k = 0; k < columns; k++) {
			const t = 0.5 * (1 - k / columns)
			const a = (y * width + k) * channels
			const b = (y * width + width - 1 - k) * channels
			for (let c = 0; c < channels; c++) {
				const left = data[a + c]
				const right = data[b + c]
				data[a + c] = left + t * (right - left)
				data[b + c] = right + t * (left - right)
			}
		}
	}
	return { ...raster, data }
}

/**
 * Replaces the rows beyond `maxLat` (degrees, both poles) by their mirror image across that
 * latitude, fading towards the ring's mean brightness at the pole: a source that never saw the
 * poles (the Sun's synoptic maps, taken from the ecliptic) closes without a smear or a hole.
 */
export const mirrorPoles = (gray: Gray, maxLat: number): Gray => {
	const { width, height } = gray
	const data = Float32Array.from(gray.data)
	const rowOf = (lat: number) =>
		Math.min(
			height - 1,
			Math.max(0, Math.round(((90 - lat) / 180) * height - 0.5)),
		)
	for (const sign of [1, -1]) {
		const edge = rowOf(sign * maxLat)
		let mean = 0
		for (let x = 0; x < width; x++) mean += gray.data[edge * width + x]
		mean /= width
		for (let y = 0; y < height; y++) {
			const lat = 90 - ((y + 0.5) / height) * 180
			if (sign * lat <= maxLat) continue
			const depth = (sign * lat - maxLat) / (90 - maxLat)
			const from = rowOf(sign * (2 * maxLat - sign * lat))
			for (let x = 0; x < width; x++) {
				const v = gray.data[from * width + x]
				data[y * width + x] = v + 0.6 * depth * (mean - v)
			}
		}
	}
	return { width, height, data }
}
