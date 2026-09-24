import * as React from "react"

import { I18nProvider } from "@/i18n"

import GSAPTransitionProvider from "./GSAPTransition"
import LayoutProvider from "./Layout"
import StylesProvider from "./Styles"

export type ProvidersProps = { children: React.ReactNode }

const Providers: React.FC<ProvidersProps> = ({ children }) => {
	return (
		<StylesProvider>
			<I18nProvider>
				<GSAPTransitionProvider>
					<LayoutProvider>{children}</LayoutProvider>
				</GSAPTransitionProvider>
			</I18nProvider>
		</StylesProvider>
	)
}

export default Providers
