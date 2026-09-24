/**
 * Mirrors the simulation store into the `/solar_system` URL and back.
 *
 * On mount the validated search params (`focus`, `at`, `sel`, `cam`, `t`,
 * `warp` and the layer switches `orbits`, `labels`, `moons`, `markers`) seed
 * the store: the view (`focus`: a body, with `at` a point in space near it,
 * absent: the overview) and its camera shot are applied as a jump, so a
 * shared link opens exactly on the view it was taken from. From then on view,
 * selection, camera shot, warp and the layer switches are written to the URL
 * as they change (the shot when the camera comes to rest) and the simulation
 * time follows at most once per second, and only while it is slow enough to
 * be worth a link (paused or |warp| <= 1 min/s).
 * Everything is `replace: true`, so the history never fills up.
 *
 * The store is watched through `useSimStore.subscribe`, not selectors: the
 * component calling this hook must not re-render at the clock's rate.
 */
import { useEffect, useLayoutEffect, useRef } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"

import { bodyById } from "@/data"
import { dateToJD } from "@/sim"

import {
	HOME_SHOT,
	OVERVIEW,
	formatOffset,
	formatShot,
	parseOffset,
	parseShot,
	sameShot,
	viewBodyId,
	type CameraShot,
	type View,
} from "./navigation"
import { hidesTimeInUrl, useBirthdayStore } from "./birthday"
import { useSimStore, type SimState } from "./sim"
import type { SimSearch } from "./simSearch"

/** Minimum spacing between two writes of `t` into the URL. */
export const TIME_SYNC_INTERVAL_MS = 1000
/** `t` is mirrored only while paused or at most at this speed (1 min/s, either direction). */
export const TIME_SYNC_MAX_WARP = 60
/** Warp written to the URL at this value is omitted (the default). */
export const DEFAULT_TIME_WARP = 1

/** Julian Date rounded to 4 decimals (about 9 s), the precision the URL carries. */
export const roundJD = (jd: number): number => Math.round(jd * 1e4) / 1e4

export const shouldMirrorTime = (paused: boolean, timeWarp: number): boolean =>
	paused || Math.abs(timeWarp) <= TIME_SYNC_MAX_WARP

/**
 * The layer switches a link carries: search param and store field. Every
 * switch is on by default, so only `false` is ever written.
 */
export const LAYER_PARAMS = [
	["orbits", "showOrbits"],
	["labels", "showLabels"],
	["moons", "showMoons"],
	["markers", "showMarkers"],
] as const

type LayerField = (typeof LAYER_PARAMS)[number][1]
type Layers = Pick<SimState, LayerField>

type Mirrored = Layers &
	Pick<
		SimState,
		"view" | "selectedId" | "shot" | "timeWarp" | "paused" | "simTimeJD"
	>

type MirroredClock = Pick<SimState, "timeWarp" | "simTimeJD">

/**
 * The search params that mirror `state`, starting from `previous` so a `t` that
 * is not being mirrored right now (fast warp) keeps its last written value.
 * Defaults (the overview, the home camera, a selection equal to the focus,
 * 1x, a layer switch that is on) are left out to keep the URL short. A point
 * view (the pivot moved into empty space, #15) is its anchor in `focus` and
 * its offset in `at`, in true radii of the anchor (scale free). The warp is
 * written as it is (not rounded), so a link runs at exactly the speed it was
 * taken at,
 * backwards included; a zero warp (which the schema rejects) is left out.
 * With `hideTime` (a birth date is entered, #26) no `t` is written at all, so
 * a copied link opens on "now" and never carries someone's birthday.
 */
export function searchFromState(
	state: Mirrored,
	previous: SimSearch,
	hideTime = false,
): SimSearch {
	const { timeWarp, view, shot } = state
	const focus = view.kind === "overview" ? undefined : viewBodyId(view)
	const anchor = view.kind === "point" ? bodyById.get(view.anchorId) : undefined
	const search: SimSearch = {
		focus,
		at:
			view.kind === "point" && anchor !== undefined
				? formatOffset(view.offsetKm, anchor.radiusKm)
				: undefined,
		sel:
			state.selectedId !== null && state.selectedId !== focus
				? state.selectedId
				: undefined,
		cam:
			shot === null || sameShot(shot, HOME_SHOT) ? undefined : formatShot(shot),
		t: hideTime
			? undefined
			: shouldMirrorTime(state.paused, timeWarp)
				? roundJD(state.simTimeJD)
				: previous.t,
		warp:
			timeWarp !== 0 && timeWarp !== DEFAULT_TIME_WARP ? timeWarp : undefined,
	}
	for (const [param, field] of LAYER_PARAMS) {
		search[param] = state[field] ? undefined : false
	}
	return search
}

export const sameSearch = (a: SimSearch, b: SimSearch): boolean =>
	a.focus === b.focus &&
	a.at === b.at &&
	a.sel === b.sel &&
	a.cam === b.cam &&
	a.t === b.t &&
	a.warp === b.warp &&
	LAYER_PARAMS.every(([param]) => a[param] === b[param])

/**
 * The view a search describes: `focus` (a known body; with a valid `at`, a
 * point near it) or the overview, its camera and selection.
 */
export function viewFromSearch(search: SimSearch): {
	view: View
	shot: CameraShot | null
	selectedId: string | null
} {
	const focus =
		search.focus !== undefined && bodyById.has(search.focus)
			? search.focus
			: null
	const sel =
		search.sel !== undefined && bodyById.has(search.sel) ? search.sel : null
	const anchor = focus === null ? undefined : bodyById.get(focus)
	const offsetKm =
		anchor === undefined ? null : parseOffset(search.at, anchor.radiusKm)
	const view: View =
		focus === null
			? OVERVIEW
			: offsetKm === null
				? { kind: "body", id: focus }
				: { kind: "point", anchorId: focus, offsetKm }
	return {
		view,
		shot: parseShot(search.cam),
		// a focused body is selected unless the link selects something else;
		// a point in space selects nothing by itself
		selectedId: sel ?? (view.kind === "body" ? focus : null),
	}
}

/** The layer switches a search sets: a switch the link leaves out is on. */
export const layersFromSearch = (search: SimSearch): Layers =>
	Object.fromEntries(
		LAYER_PARAMS.map(([param, field]) => [field, search[param] ?? true]),
	) as Layers

/** Clock fields a search sets; absent params are skipped. */
export function stateFromSearch(search: SimSearch): Partial<MirroredClock> {
	const next: Partial<MirroredClock> = {}
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
): Partial<MirroredClock> {
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
		// URL -> store, once; the view is a jump since the page is just appearing.
		// Time goes through the clock actions (issue #9), never a bare setState.
		const { simTimeJD, timeWarp } = mountState(searchRef.current)
		const store = useSimStore.getState()
		if (timeWarp !== undefined) store.setTimeWarp(timeWarp)
		if (simTimeJD !== undefined) store.setSimTime(simTimeJD)
		const { view, shot, selectedId } = viewFromSearch(searchRef.current)
		store.jumpTo(view, shot)
		store.select(selectedId)
		// the layer switches are plain fields
		useSimStore.setState(layersFromSearch(searchRef.current))

		let timer: ReturnType<typeof setTimeout> | undefined
		const write = () => {
			const next = searchFromState(
				useSimStore.getState(),
				searchRef.current,
				hidesTimeInUrl(useBirthdayStore.getState()),
			)
			if (sameSearch(next, searchRef.current)) return
			searchRef.current = next
			void navigate({ to: "/solar_system", search: next, replace: true })
		}

		// store -> URL: view, selection, camera, warp, pause and layer changes right
		// away (a pause also pins `t`); the running clock at most once per TIME_SYNC_INTERVAL_MS
		const unsubscribe = useSimStore.subscribe((state, previous) => {
			if (
				state.view !== previous.view ||
				state.selectedId !== previous.selectedId ||
				state.shot !== previous.shot ||
				state.timeWarp !== previous.timeWarp ||
				state.paused !== previous.paused ||
				LAYER_PARAMS.some(([, field]) => state[field] !== previous[field])
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
		// entering or forgetting a birth date takes `t` out of the URL or puts it back
		const unsubscribeBirthday = useBirthdayStore.subscribe(
			(state, previous) => {
				if (hidesTimeInUrl(state) !== hidesTimeInUrl(previous)) write()
			},
		)
		write()

		return () => {
			unsubscribe()
			unsubscribeBirthday()
			if (timer !== undefined) clearTimeout(timer)
		}
	}, [navigate])
}

export default useSimUrlSync
