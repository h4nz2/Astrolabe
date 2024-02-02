import * as React from "react"
import { Box, createStyles, DefaultMantineColor } from "@mantine/core"
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
	const [didMount, setDidMount] = React.useState<boolean>(false)
	React.useEffect(() => {
		setDidMount(true)
	}, [])

	const { setBackground } = useGSAPTransition()
	React.useEffect(() => {
		setBackground(backgroundColor || "dark")
	}, [backgroundColor, setBackground])

	const emptyBox = <Box component="main">{null}</Box>
	const body = (
		<FadeInOutUp>
			<Box component="main">{children}</Box>
		</FadeInOutUp>
	)
	return didMount ? body : emptyBox
}

export default LayoutProvider
