/** The viewer's accessibility preferences the presentation mode follows (#29). */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
export const MORE_CONTRAST_QUERY = "(prefers-contrast: more)"

const matches = (query: string): boolean =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia(query).matches

/** The viewer asked for less motion: moves started from the keyboard jump instead of flying. */
export const prefersReducedMotion = (): boolean => matches(REDUCED_MOTION_QUERY)

/** The viewer asked for more contrast: the high-contrast styles apply without a switch. */
export const prefersMoreContrast = (): boolean => matches(MORE_CONTRAST_QUERY)
