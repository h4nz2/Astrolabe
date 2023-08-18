import * as React from "react"

import AnimateInOut, { AnimateInOutProps } from "./AnimateInOut"

export type FadeInOutUpProps = {
	children: React.ReactNode
	y?: gsap.TweenValue
	delay?: AnimateInOutProps["delay"]
	durationIn?: AnimateInOutProps["durationIn"]
	durationOut?: AnimateInOutProps["durationOut"]
}
const FadeInOutUp: React.FC<FadeInOutUpProps> = ({
	children,
	delay,
	y = 40,
	durationIn = 2,
	durationOut = 0.25,
}) => {
	const from = React.useMemo(
		() => ({
			transform: `translate(0px, ${y}px)`,
			opacity: 0,
			duration: 0.25,
			ease: "power4.out",
		}),
		[y],
	)
	const to = React.useMemo(
		() => ({ opacity: 1, y: 0, ease: "power4.out", delay: 0.5 }),
		[],
	)

	return (
		<AnimateInOut
			durationIn={durationIn}
			durationOut={durationOut}
			delay={delay}
			from={from}
			to={to}
		>
			{children}
		</AnimateInOut>
	)
}

export default FadeInOutUp
