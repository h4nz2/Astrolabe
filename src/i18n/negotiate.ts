/**
 * Picking the active locale and reading level (pure, no React, no DOM).
 *
 * Precedence for both: the URL (`?lang=de&reading=simple`, so a shared link
 * shows exactly what the sender saw) > the viewer's saved choice > for the
 * locale, the browser's language list > the defaults from src/locales/config.json.
 */

const normalize = (tag: string): string => tag.trim().replace(/_/g, "-")

/**
 * The available locale that serves `tag`: an exact match (case-insensitive), else
 * the tag with its trailing subtags stripped one by one ("de-CH-1996" -> "de-CH" -> "de").
 */
export function matchLocale(
	tag: string | null | undefined,
	available: readonly string[],
): string | undefined {
	if (typeof tag !== "string" || tag.trim() === "") return undefined
	const byLower = new Map(available.map((id) => [id.toLowerCase(), id]))
	const parts = normalize(tag).toLowerCase().split("-")
	for (let length = parts.length; length > 0; length -= 1) {
		const match = byLower.get(parts.slice(0, length).join("-"))
		if (match !== undefined) return match
	}
	return undefined
}

export interface LocaleSources {
	/** `?lang=` as validated by the root route (any string). */
	url?: string
	/** The viewer's last explicit choice (localStorage). */
	stored?: string | null
	/** `navigator.languages`, most preferred first. */
	browser?: readonly string[]
}

/** URL > stored choice > first browser language we have > `fallback`. */
export function resolveLocale(
	sources: LocaleSources,
	available: readonly string[],
	fallback: string,
): string {
	return (
		matchLocale(sources.url, available) ??
		matchLocale(sources.stored, available) ??
		(sources.browser ?? [])
			.map((tag) => matchLocale(tag, available))
			.find((match) => match !== undefined) ??
		fallback
	)
}

/** URL > stored choice > `fallback`; unknown levels are ignored. */
export function resolveReadingLevel(
	sources: { url?: string; stored?: string | null },
	levels: readonly string[],
	fallback: string,
): string {
	for (const candidate of [sources.url, sources.stored]) {
		if (typeof candidate === "string" && levels.includes(candidate)) {
			return candidate
		}
	}
	return fallback
}

/**
 * The tag `Intl` formats with. Strings come from `locale`, but numbers and dates
 * follow the viewer's region when the browser asks for a regional variant of the
 * same language: "de" text is formatted as "de-CH" (149’598’261) for a Swiss
 * browser and as "de" (149.598.261) otherwise. Never another language's rules.
 */
export function formattingLocale(
	locale: string,
	browser: readonly string[] = [],
): string {
	const language = locale.toLowerCase()
	for (const tag of browser) {
		const normalized = normalize(tag)
		const lower = normalized.toLowerCase()
		if (lower === language) return locale
		if (lower.startsWith(`${language}-`) && isSupportedTag(normalized)) {
			return normalized
		}
	}
	return locale
}

const isSupportedTag = (tag: string): boolean => {
	try {
		return Intl.NumberFormat.supportedLocalesOf([tag]).length > 0
	} catch {
		return false
	}
}

/**
 * Where messages are looked up, most specific first: "de-CH" -> ["de-CH", "de", "en"].
 * Only ids in `available` are kept, so a regional overlay (a "de-CH" folder holding
 * only the strings that differ) falls back to its language and then to `fallback`.
 */
export function localeChain(
	locale: string,
	available: readonly string[],
	fallback: string,
): string[] {
	const chain: string[] = []
	const parts = locale.split("-")
	for (let length = parts.length; length > 0; length -= 1) {
		const match = matchLocale(parts.slice(0, length).join("-"), available)
		if (match !== undefined && !chain.includes(match)) chain.push(match)
	}
	if (!chain.includes(fallback)) chain.push(fallback)
	return chain
}
