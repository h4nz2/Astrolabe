import { createContext, useContext } from "react"

import type { Locale, ReadingLevel } from "./catalog"
import { createI18n, type I18n } from "./core"

export interface I18nContextValue extends I18n {
	/** Switches the language (URL + remembered choice). */
	setLocale: (locale: Locale) => void
	/** Switches the reading level (URL + remembered choice). */
	setReadingLevel: (level: ReadingLevel) => void
}

const fallback: I18nContextValue = {
	...createI18n(),
	setLocale: () => {},
	setReadingLevel: () => {},
}

/** Provided by `I18nProvider` (src/providers); English/standard outside of it. */
export const I18nContext = createContext<I18nContextValue>(fallback)

/**
 * The active translator and formatters: `const { t, number } = useI18n()`.
 * Re-renders the component when the language or the reading level changes.
 * Works inside the R3F `<Canvas>` too (fiber 9 bridges context).
 */
export const useI18n = (): I18nContextValue => useContext(I18nContext)
