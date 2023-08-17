import * as React from "react"
import gsap from "gsap"

import { Box } from "@mantine/core"
import type { BoxProps } from "@mantine/core"
import { PolymorphicComponentProps } from "@mantine/utils"
import AnimateInOut from "./AnimateInOut"

export type ScaleInOutProps<C = "div"> = Pick<
	PolymorphicComponentProps<C, BoxProps>,
	"component"
> & {
	children: React.ReactNode
	delay: gsap.TweenValue
	scale?: gsap.TweenValue
	ease?: string | gsap.EaseFunction
	duration?: gsap.TweenValue
	x?: gsap.TweenValue
	y?: gsap.TweenValue
	skipOutro?: boolean
	scaleTo?: gsap.TweenValue
	xTo?: gsap.TweenValue
	yTo?: gsap.TweenValue
}

const ScaleInOut: React.FC<ScaleInOutProps> = ({
	children,
	component,
	duration = 1,
	delay,
	skipOutro,
	scale = 0.01,
	ease = "elastic.out",
	x = 0,
	y = 0,
	scaleTo = 1,
	xTo = 0,
	yTo = 0,
}) => {
	const from = React.useMemo(() => ({ opacity: 0, scale, x, y }), [scale, x, y])
	const to = React.useMemo(
		() => ({ opacity: 1, scale: scaleTo, ease, x: xTo, y: yTo }),
		[scaleTo, ease, xTo, yTo],
	)

	return (
		<AnimateInOut
			durationIn={duration}
			durationOut={Number(duration) / 4}
			delay={delay}
			skipOutro={skipOutro}
			set={from}
			from={from}
			to={to}
			component={component}
		>
			{children}
		</AnimateInOut>
	)
}

export default ScaleInOut
