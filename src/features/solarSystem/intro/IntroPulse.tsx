/**
 * Earth's gentle "click me" after the opening (#30): a ring that breathes
 * around Earth until the viewer picks something (or for `PULSE_MS`). Placed
 * every frame by `IntroPulseTracker`; with reduced motion it is a still ring.
 */
import { useEffect, useLayoutEffect, useRef } from "react"

import { stopPulse, useIntroStore } from "./intro"
import { PULSE_MS, pulseSlot } from "./pulse"

import classes from "./Intro.module.css"

const IntroPulse = () => {
	const ref = useRef<HTMLDivElement>(null)
	const pulse = useIntroStore((state) => state.pulse)

	useLayoutEffect(() => {
		pulseSlot.element = ref.current
		return () => {
			pulseSlot.element = null
		}
	}, [])

	useEffect(() => {
		if (!pulse) return
		const timer = setTimeout(stopPulse, PULSE_MS)
		return () => clearTimeout(timer)
	}, [pulse])

	return (
		<div className={classes.pulseLayer} aria-hidden="true">
			<div ref={ref} className={classes.pulse} data-testid="intro-pulse">
				<span className={classes.pulseWave} />
			</div>
		</div>
	)
}

export default IntroPulse
