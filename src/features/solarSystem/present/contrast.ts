/**
 * WCAG 2 contrast (#29): the numbers behind the high-contrast colours in
 * presentation.css, checked by contrast.test.ts.
 */

export type Rgb = readonly [number, number, number]

/** "#rrggbb" or "#rgb" to 0..255 channels. */
export function parseHex(hex: string): Rgb {
	const digits = hex.replace("#", "")
	const full =
		digits.length === 3
			? digits
					.split("")
					.map((digit) => digit + digit)
					.join("")
			: digits
	const value = Number.parseInt(full, 16)
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** `top` at `alpha` over an opaque `bottom`. */
export const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb =>
	[0, 1, 2].map(
		(i) => top[i] * alpha + bottom[i] * (1 - alpha),
	) as unknown as Rgb

const channel = (value: number): number => {
	const c = value / 255
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance. */
export const luminance = ([r, g, b]: Rgb): number =>
	0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return (light + 0.05) / (dark + 0.05)
}
