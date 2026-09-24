import * as React from "react"
import {
	createTheme,
	MantineProvider,
	type MantineColorsTuple,
} from "@mantine/core"

// Mantine 6's dark palette: the app was designed on it (dark[7] = #1a1b1e is also what
// index.html paints before the CSS loads), while Mantine 9 ships a lighter dark[7] (#242424).
const dark: MantineColorsTuple = [
	"#C1C2C5",
	"#A6A7AB",
	"#909296",
	"#5c5f66",
	"#373A40",
	"#2C2E33",
	"#25262b",
	"#1A1B1E",
	"#141517",
	"#101113",
]

export const theme = createTheme({
	primaryColor: "orange",
	primaryShade: 7,
	colors: { dark },
})

export type StylesProviderProps = { children: React.ReactNode }

const StylesProvider: React.FC<StylesProviderProps> = ({ children }) => {
	return (
		<MantineProvider theme={theme} forceColorScheme="dark">
			{children}
		</MantineProvider>
	)
}

export default StylesProvider
