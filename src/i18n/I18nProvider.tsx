import {
	useCallback,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import {
	DEFAULT_LOCALE,
	DEFAULT_READING_LEVEL,
	LOCALES,
	READING_LEVELS,
	type Locale,
	type ReadingLevel,
} from "./catalog"
import { I18nContext, type I18nContextValue } from "./context"
import { createI18n } from "./core"
import { applyDocumentLocale, applyManifest } from "./document"
import {
	formattingLocale,
	resolveLocale,
	resolveReadingLevel,
} from "./negotiate"
import {
	browserLanguages,
	LOCALE_STORAGE_KEY,
	READING_LEVEL_STORAGE_KEY,
	readPreference,
	writePreference,
} from "./storage"

export type I18nProviderProps = { children: ReactNode }

/**
 * Resolves the active language and reading level (URL > remembered choice >
 * browser > defaults) and provides them to `useI18n()`.
 *
 * The URL always states both (`?lang=en&reading=standard`): a missing or
 * unknown value is replaced right away, so whatever a teacher sees is exactly
 * what the link in the address bar shows the class. Rendered by the root route,
 * so `useSearch` sees the params on every page.
 */
function I18nProvider({ children }: I18nProviderProps) {
	const search = useSearch({ from: "__root__" })
	const navigate = useNavigate()
	const [browser] = useState(browserLanguages)
	const [stored, setStored] = useState(() => ({
		locale: readPreference(LOCALE_STORAGE_KEY),
		readingLevel: readPreference(READING_LEVEL_STORAGE_KEY),
	}))

	const locale = resolveLocale(
		{ url: search.lang, stored: stored.locale, browser },
		LOCALES,
		DEFAULT_LOCALE,
	)
	const readingLevel = resolveReadingLevel(
		{ url: search.reading, stored: stored.readingLevel },
		READING_LEVELS,
		DEFAULT_READING_LEVEL,
	) as ReadingLevel

	// replace, not push: switching the language is not a step back and forth through history
	const writeUrl = useCallback(
		(lang: Locale, reading: ReadingLevel) =>
			void navigate({
				to: ".",
				// relative to the current URL, so it also works on the not-found page
				unsafeRelative: "path",
				search: (previous) => ({ ...previous, lang, reading }),
				replace: true,
			}),
		[navigate],
	)

	const value = useMemo<I18nContextValue>(
		() => ({
			...createI18n({
				locale,
				readingLevel,
				formatLocale: formattingLocale(locale, browser),
			}),
			setLocale: (next) => {
				writePreference(LOCALE_STORAGE_KEY, next)
				setStored((previous) => ({ ...previous, locale: next }))
				writeUrl(next, readingLevel)
			},
			setReadingLevel: (next) => {
				writePreference(READING_LEVEL_STORAGE_KEY, next)
				setStored((previous) => ({ ...previous, readingLevel: next }))
				writeUrl(locale, next)
			},
		}),
		[browser, locale, readingLevel, writeUrl],
	)

	useEffect(() => {
		if (search.lang !== locale || search.reading !== readingLevel) {
			writeUrl(locale, readingLevel)
		}
	}, [search.lang, search.reading, locale, readingLevel, writeUrl])

	useEffect(() => {
		const { t } = value
		applyDocumentLocale(document, {
			lang: value.locale,
			title: t("app.title"),
			description: t("app.description"),
			applicationName: t("app.installName"),
		})
		void applyManifest(document, {
			lang: value.locale,
			name: t("app.installName"),
			shortName: t("app.shortName"),
			description: t("app.description"),
		})
	}, [value])

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export default I18nProvider
