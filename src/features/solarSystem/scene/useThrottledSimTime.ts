/**
 * `simTimeJD` for React UI, updated at most every `intervalMs` (default 10 Hz).
 *
 * SimClock writes the store every frame; a plain `useSimStore((s) => s.simTimeJD)`
 * would re-render its component at the frame rate. This hook subscribes with
 * `useSimStore.subscribe` and exposes a throttled snapshot through
 * `useSyncExternalStore`: the first change after a quiet period is published
 * immediately (a "Now" click shows at once), later ones are coalesced.
 */
import { useMemo, useSyncExternalStore } from "react"

import { useSimStore, type SimState } from "@/store/sim"

export const SIM_TIME_UI_INTERVAL_MS = 100

export interface ThrottledSimTimeSource {
	subscribe: (onChange: () => void) => () => void
	getSnapshot: () => number
}

/** The throttled store behind the hook; exported for tests. */
export function createThrottledSimTimeSource(
	intervalMs: number,
): ThrottledSimTimeSource {
	let snapshot = useSimStore.getState().simTimeJD
	let lastPublishedAt = -Infinity
	let timer: ReturnType<typeof setTimeout> | null = null
	let unsubscribeStore: (() => void) | null = null
	const listeners = new Set<() => void>()

	const publish = () => {
		timer = null
		lastPublishedAt = performance.now()
		const jd = useSimStore.getState().simTimeJD
		if (jd === snapshot) return
		snapshot = jd
		for (const listener of listeners) listener()
	}

	const onStoreChange = (state: SimState, previous: SimState) => {
		if (state.simTimeJD === previous.simTimeJD || timer !== null) return
		const wait = intervalMs - (performance.now() - lastPublishedAt)
		if (wait <= 0) publish()
		else timer = setTimeout(publish, wait)
	}

	return {
		subscribe(onChange) {
			listeners.add(onChange)
			if (unsubscribeStore === null) {
				unsubscribeStore = useSimStore.subscribe(onStoreChange)
			}
			// Catch up on changes made while nobody listened; React compares
			// getSnapshot() right after subscribing, so no notification is needed.
			snapshot = useSimStore.getState().simTimeJD
			return () => {
				listeners.delete(onChange)
				if (listeners.size > 0) return
				unsubscribeStore?.()
				unsubscribeStore = null
				if (timer !== null) {
					clearTimeout(timer)
					timer = null
				}
			}
		},
		getSnapshot: () => snapshot,
	}
}

export function useThrottledSimTime(
	intervalMs: number = SIM_TIME_UI_INTERVAL_MS,
): number {
	const source = useMemo(
		() => createThrottledSimTimeSource(intervalMs),
		[intervalMs],
	)
	return useSyncExternalStore(source.subscribe, source.getSnapshot)
}

export default useThrottledSimTime
