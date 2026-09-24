/**
 * Makes the page itself follow the active locale: `<html lang>` (the screen
 * reader's voice), the title, the description and application-name metas, and
 * the web app manifest (the name an installed app shows).
 *
 * index.html ships the English values for the moment before the script runs.
 * The manifest stays a static file (public/manifest.json) that serves as the
 * template: the localized copy is built from it at runtime and swapped in as a
 * data: URL, so there is one manifest to maintain and a new locale needs no file.
 */

export interface DocumentLocale {
	/** Content language for `<html lang>` ("en", "de"). */
	lang: string
	title: string
	description: string
	applicationName: string
}

const setMeta = (doc: Document, name: string, content: string): void => {
	let meta = doc.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
	if (meta === null) {
		meta = doc.createElement("meta")
		meta.name = name
		doc.head.appendChild(meta)
	}
	meta.content = content
}

export function applyDocumentLocale(doc: Document, meta: DocumentLocale): void {
	doc.documentElement.lang = meta.lang
	doc.title = meta.title
	setMeta(doc, "description", meta.description)
	setMeta(doc, "application-name", meta.applicationName)
}

export interface ManifestLocale {
	lang: string
	name: string
	shortName: string
	description: string
	/** The URL the template was loaded from; its relative URLs resolve against it. */
	manifestUrl: string
}

type Manifest = Record<string, unknown> & {
	icons?: Array<Record<string, unknown>>
}

/**
 * The template with localized texts. A data: URL has no base, so every relative
 * URL (start_url, scope, icons) is made absolute against the template's URL.
 * The installed app starts in its language (`start_url` carries `?lang=`) but
 * keeps one identity (`id`) across languages.
 */
export function localizeManifest(
	template: Manifest,
	locale: ManifestLocale,
): Manifest {
	const absolute = (value: unknown, fallback: string): string =>
		new URL(typeof value === "string" ? value : fallback, locale.manifestUrl)
			.href
	const start = new URL(absolute(template.start_url, "."))
	const id = absolute(template.id ?? template.start_url, ".")
	start.searchParams.set("lang", locale.lang)
	return {
		...template,
		id,
		lang: locale.lang,
		name: locale.name,
		short_name: locale.shortName,
		description: locale.description,
		start_url: start.href,
		scope: absolute(template.scope, "."),
		icons: template.icons?.map((icon) => ({
			...icon,
			src: absolute(icon.src, "."),
		})),
	}
}

let template: Promise<{ url: string; manifest: Manifest } | null> | undefined

const loadTemplate = (link: HTMLLinkElement) => {
	// the original href (a file under public/) is remembered before it is replaced
	link.dataset.template ??= link.href
	const url = link.dataset.template
	template ??= fetch(url)
		.then((response) => (response.ok ? response.json() : null))
		.then((manifest: Manifest | null) =>
			manifest === null ? null : { url, manifest },
		)
		.catch(() => null)
	return template
}

/** Swaps the manifest link for a localized copy; a no-op when there is no manifest. */
export async function applyManifest(
	doc: Document,
	locale: Omit<ManifestLocale, "manifestUrl">,
): Promise<void> {
	const link = doc.head.querySelector<HTMLLinkElement>('link[rel="manifest"]')
	if (link === null) return
	const loaded = await loadTemplate(link)
	if (loaded === null) return
	const manifest = localizeManifest(loaded.manifest, {
		...locale,
		manifestUrl: loaded.url,
	})
	link.href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`
}
