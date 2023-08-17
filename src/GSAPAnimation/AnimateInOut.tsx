import * as React from "react"
import gsap from "gsap"
import { Box } from "@mantine/core"
import { useGSAPTransition } from "@/providers/GSAPTransition"
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect"
import type { BoxProps, Sx } from "@mantine/core"
import type { PolymorphicComponentProps } from "@mantine/utils"

export type AnimateInOutProps<C = "div"> = PolymorphicComponentProps<
	C,
	BoxProps
> & {
	children: React.ReactNode
	set?: gsap.TweenVars
	to: gsap.TweenVars
	from: gsap.CSSVars
	delay?: gsap.TweenValue
	delayOut?: gsap.TweenValue
	durationIn: gsap.TweenValue
	durationOut: gsap.TweenValue
	skipOutro?: boolean
}

const AnimateInOut: React.FC<AnimateInOutProps> = ({
	children,
	set,
	to,
	from,
	delay = 0,
	delayOut = 0,
	durationIn,
	durationOut,
	skipOutro,
	...boxProps
}) => {
	const boxRef = React.useRef<HTMLDivElement>(null!)
	const { timeline } = useGSAPTransition()

	useIsomorphicLayoutEffect(() => {
		// intro animation
		gsap.set("main", { overflow: "hidden" })
		if (set) gsap.set(boxRef.current, { ...set })

		gsap.to(boxRef.current, {
			...to,
			delay,
			duration: durationIn,
			onComplete: () => {
				gsap.set("main", { overflow: "auto" })
			},
		})
		// outro animation
		if (!skipOutro)
			timeline.add(
				gsap.to(boxRef.current, {
					...from,
					delay: delayOut,
					duration: durationOut,
					onComplete: () => {
						gsap.set("main", { overflow: "auto" })
					},
				}),
				0.5,
			)
	}, [])

	return (
		<Box ref={boxRef} sx={from as Sx | (Sx | undefined)[]} {...boxProps}>
			{children}
		</Box>
	)
}

export default AnimateInOut
