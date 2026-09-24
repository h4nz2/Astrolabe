/**
 * The frame rate the scene actually draws at, measured from SimClock's ticks
 * (`lastTickMs`) over the last second; 0 until the first second is measured
 * and while nothing is drawn. Re-renders at most once a second, and only when
 * the rounded rate changes.
 */
import { useEffect, useState } from "react"

import { useSimStore } from "@/store/sim"

export const FRAME_RATE_WINDOW_MS = 1000

export function useFrameRate(): number {
	const [fps, setFps] = useState(0)

	useEffect(() => {
		let frames = 0
		let windowStart = performance.now()
		const unsubscribe = useSimStore.subscribe((state, previous) => {
			if (state.lastTickMs !== previous.lastTickMs) frames += 1
		})
		const timer = setInterval(() => {
			const now = performance.now()
			const measured = Math.round((frames * 1000) / (now - windowStart))
			frames = 0
			windowStart = now
			setFps(measured)
		}, FRAME_RATE_WINDOW_MS)
		return () => {
			unsubscribe()
			clearInterval(timer)
		}
	}, [])

	return fps
}

export default useFrameRate
