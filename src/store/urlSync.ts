/**
 * Mirrors the simulation store into the `/solar_system` URL and back.
 *
 * On mount the validated search params (`focus`, `t`, `warp`) seed the store;
 * from then on focus and warp are written to the URL as they change and the
 * simulation time follows at most once per second, and only while it is slow
 * enough to be worth a link (paused or warp <= 1 min/s). Everything is
 * `replace: true`, so the history never fills up.
 *
 * The store is watched through `useSimStore.subscribe`, not selectors: the
 * component calling this hook must not re-render at the clock's rate.
 */
import { useEffect, useLayoutEffect, useRef } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { bodyById } from "@/data"
import { dateToJD } from "@/sim"

import { DEFAULT_FOCUS_ID, useSimStore, type SimState } from "./sim"
import type { SimSearch } from "./simSearch"

/** Minimum spacing between two writes of `t` into the URL. */
export const TIME_SYNC_INTERVAL_MS = 1000
/** `t` is mirrored only while paused or at most at this warp (1 min/s). */
export const TIME_SYNC_MAX_WARP = 60
/** Warp written to the URL at this value is omitted (the default). */
export const DEFAULT_TIME_WARP = 1

/** Julian Date rounded to 4 decimals (about 9 s), the precision the URL carries. */
export const roundJD = (jd: number): number => Math.round(jd * 1e4) / 1e4

export const shouldMirrorTime = (paused: boolean, timeWarp: number): boolean =>
	paused || timeWarp <= TIME_SYNC_MAX_WARP

type Mirrored = Pick<SimState, "focusId" | "timeWarp" | "paused" | "simTimeJD">

/**
 * The search params that mirror `state`, starting from `previous` so a `t` that
 * is not being mirrored right now (fast warp) keeps its last written value.
 * Defaults (Sun, 1x) are left out to keep the URL short. The warp is written
 * as it is (not rounded), so a link runs at exactly the speed it was taken at;
 * a warp the schema would reject (zero or negative) is left out.
 */
export function searchFromState(
	state: Mirrored,
	previous: SimSearch,
): SimSearch {
	const { timeWarp } = state
	return {
		focus: state.focusId === DEFAULT_FOCUS_ID ? undefined : state.focusId,
		t: shouldMirrorTime(state.paused, timeWarp)
			? roundJD(state.simTimeJD)
			: previous.t,
		warp: timeWarp > 0 && timeWarp !== DEFAULT_TIME_WARP ? timeWarp : undefined,
	}
}

export const sameSearch = (a: SimSearch, b: SimSearch): boolean =>
	a.focus === b.focus && a.t === b.t && a.warp === b.warp

/** Store fields a search sets; unknown bodies and absent params are skipped. */
export function stateFromSearch(search: SimSearch): Partial<Mirrored> {
	const next: Partial<Mirrored> = {}
	if (search.focus !== undefined && bodyById.has(search.focus)) {
		next.focusId = search.focus
	}
	if (search.t !== undefined && Number.isFinite(search.t)) {
		next.simTimeJD = search.t
	}
	if (search.warp !== undefined && Number.isFinite(search.warp)) {
		next.timeWarp = search.warp
	}
	return next
}

/**
 * The store fields the page seeds on mount: the search params, and the wall
 * clock when the URL carries no `t`. The store module may have been evaluated
 * long before the page appears (route preloading, an earlier visit) and the
 * clock stands still while the scene is unmounted, so a link without `t`
 * means "now", not "whenever the chunk loaded".
 */
export function mountState(
	search: SimSearch,
	now: Date = new Date(),
): Partial<Mirrored> {
	const next = stateFromSearch(search)
	if (next.simTimeJD === undefined) next.simTimeJD = dateToJD(now)
	return next
}

/** Two-way sync between `useSimStore` and the `/solar_system` search params. Call it once, in the page. */
export function useSimUrlSync(): void {
	const search = useSearch({ from: "/solar_system" })
	const navigate = useNavigate()
	// the URL as last seen (rendered or written by us); a ref so the sync effect never re-runs
	const searchRef = useRef<SimSearch>(search)
	useEffect(() => {
		searchRef.current = search
	}, [search])

	useLayoutEffect(() => {
		// URL -> store, once; a jump (no fly) since the page is just appearing
		useSimStore.setState({ ...mountState(searchRef.current), fly: null })

		let timer: ReturnType<typeof setTimeout> | undefined
		const write = () => {
			const next = searchFromState(useSimStore.getState(), searchRef.current)
			if (sameSearch(next, searchRef.current)) return
			searchRef.current = next
			void navigate({ to: "/solar_system", search: next, replace: true })
		}

		// store -> URL: focus, warp and pause changes right away (a pause also pins `t`);
		// the running clock at most once per TIME_SYNC_INTERVAL_MS
		const unsubscribe = useSimStore.subscribe((state, previous) => {
			if (
				state.focusId !== previous.focusId ||
				state.timeWarp !== previous.timeWarp ||
				state.paused !== previous.paused
			) {
				write()
				return
			}
			if (
				state.simTimeJD !== previous.simTimeJD &&
				timer === undefined &&
				shouldMirrorTime(state.paused, state.timeWarp)
			) {
				timer = setTimeout(() => {
					timer = undefined
					write()
				}, TIME_SYNC_INTERVAL_MS)
			}
		})
		write()

		return () => {
			unsubscribe()
			if (timer !== undefined) clearTimeout(timer)
		}
	}, [navigate])
}

export default useSimUrlSync
