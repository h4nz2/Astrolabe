import * as React from "react"

import gsap from "gsap"
import { Box, DefaultMantineColor, useMantineTheme } from "@mantine/core"

type TransitionContext = {
	timeline: gsap.core.Timeline
	setTimeline: React.Dispatch<React.SetStateAction<gsap.core.Timeline>>
	background: DefaultMantineColor
	setBackground: React.Dispatch<React.SetStateAction<DefaultMantineColor>>
}

const transitionContext = React.createContext<TransitionContext>(null!)

const { Provider } = transitionContext
export type GSAPTransitionProviderProps = {
	children: React.ReactNode
}

const GSAPTransitionProvider: React.FC<GSAPTransitionProviderProps> = ({
	children,
}) => {
	const { primaryColor } = useMantineTheme()

	const [background, setBackground] = React.useState(primaryColor)

	const [timeline, setTimeline] = React.useState(() =>
		gsap.timeline({ paused: true }),
	)

	const context: TransitionContext = {
		timeline,
		setTimeline,
		background,
		setBackground,
	}

	return <Provider value={context}>{children}</Provider>
}
export const useGSAPTransition = () => React.useContext(transitionContext)

export default GSAPTransitionProvider
