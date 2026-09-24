import * as React from "react"
import { Box, DefaultMantineColor } from "@mantine/core"
import { useGSAPTransition } from "@/providers/GSAPTransition"
import FadeInOutUp from "@/GSAPAnimation/FadeInOutUp"

export type LayoutProviderProps = {
	children: React.ReactNode
	backgroundColor?: DefaultMantineColor
}

const LayoutProvider: React.FC<LayoutProviderProps> = ({
	children,
	backgroundColor,
}) => {
	const { setBackground } = useGSAPTransition()
	React.useEffect(() => {
		setBackground(backgroundColor || "dark")
	}, [backgroundColor, setBackground])

	return (
		<FadeInOutUp>
			<Box component="main">{children}</Box>
		</FadeInOutUp>
	)
}

export default LayoutProvider
