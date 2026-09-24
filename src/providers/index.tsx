import * as React from "react"
import GSAPTransitionProvider from "./GSAPTransition"
import LayoutProvider from "./Layout"
import StylesProvider from "./Styles"

export type ProvidersProps = { children: React.ReactNode }

const Providers: React.FC<ProvidersProps> = ({ children }) => {
	return (
		<StylesProvider>
			<GSAPTransitionProvider>
				<LayoutProvider>{children}</LayoutProvider>
			</GSAPTransitionProvider>
		</StylesProvider>
	)
}

export default Providers
