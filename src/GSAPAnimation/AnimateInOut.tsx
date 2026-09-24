import * as React from "react"
import gsap from "gsap"
import { Box } from "@mantine/core"
import { useGSAPTransition } from "@/providers/GSAPTransition"
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect"
import type { BoxProps, PolymorphicComponentProps } from "@mantine/core"

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
	const boxRef = React.useRef<HTMLDivElement>(null)
	const { timeline } = useGSAPTransition()

	useIsomorphicLayoutEffect(() => {
		const box = boxRef.current
		if (!box) return

		// intro animation
		gsap.set("main", { overflow: "hidden" })
		// initial state (applied before the first paint): `from`, overridden by `set`.
		// gsap owns it instead of an inline `style` so gsap-only vars (x, y, scale, ...)
		// never leak into CSS.
		gsap.set(box, { ...from, ...set })

		const intro = gsap.to(box, {
			...to,
			delay,
			duration: durationIn,
			onComplete: () => {
				gsap.set("main", { overflow: "auto" })
			},
		})
		// outro animation, parked in the shared transition timeline
		const outro = skipOutro
			? null
			: gsap.to(box, {
					...from,
					delay: delayOut,
					duration: durationOut,
					onComplete: () => {
						gsap.set("main", { overflow: "auto" })
					},
				})
		if (outro) timeline.add(outro, 0.5)

		// StrictMode (dev) runs mount -> cleanup -> mount: without this every remount would
		// leave a second intro tween on the element and a second outro in the timeline.
		return () => {
			intro.kill()
			if (outro) {
				timeline.remove(outro)
				outro.kill()
			}
		}
	}, [])

	return (
		<Box ref={boxRef} {...boxProps}>
			{children}
		</Box>
	)
}

export default AnimateInOut
