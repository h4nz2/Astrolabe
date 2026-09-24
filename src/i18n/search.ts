/**
 * Search params every route carries: `?lang=de&reading=simple`.
 *
 * Validated by the root route (src/routes/__root.tsx) and kept on every
 * navigation by its `retainSearchParams` middleware, so a link or a `navigate`
 * that does not mention them never drops them. Values are loose strings here;
 * the provider matches them against the shipped locales and reading levels and
 * ignores anything unknown. Only zod is imported: the root route is eager.
 */
import { z } from "zod"

export const I18N_SEARCH_KEYS = ["lang", "reading"] as const

export const i18nSearchSchema = z.object({
	lang: z.string().optional().catch(undefined),
	reading: z.string().optional().catch(undefined),
})

export type I18nSearch = z.output<typeof i18nSearchSchema>
