/**
 * Puts the presentation settings (#29) on `<html>`, where every style keyed
 * on them can see them, including Mantine's portals (menus, popovers,
 * tooltips) that render outside the page:
 *
 * - `data-presenting`: projector mode (presentation.css grows the root font
 *   size, so everything sized in rem grows with it);
 * - `data-contrast="high"`: the switch, or the viewer's `prefers-contrast: more`;
 * - `data-chrome="hidden"`: every HUD panel hidden.
 *
 * The attributes are removed when the page unmounts. Label sizes are measured
 * on resize (labels/LabelLayer.tsx), so a change that resizes text announces
 * itself as one.
 */
import { useEffect, useState } from "react"

import { usePresentationStore } from "@/store/presentation"

import { MORE_CONTRAST_QUERY, prefersMoreContrast } from "./media"

/** The lazily loaded HUD chunks: fetched once presenting, so no panel waits on the network mid-lesson. */
const preloadLazyPanels = () => {
	void import("../ui/DayPicker").catch(() => undefined)
	void import("../birthday/BirthdayPanel").catch(() => undefined)
	void import("./SharePanel").catch(() => undefined)
}

/** True while the viewer's system asks for more contrast. */
export function usePrefersMoreContrast(): boolean {
	const [more, setMore] = useState(prefersMoreContrast)
	useEffect(() => {
		if (typeof window.matchMedia !== "function") return
		const query = window.matchMedia(MORE_CONTRAST_QUERY)
		const update = () => setMore(query.matches)
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])
	return more
}

const setAttribute = (name: string, value: string | null) => {
	const root = document.documentElement
	if (value === null) root.removeAttribute(name)
	else root.setAttribute(name, value)
}

export function usePresentationDocument(): void {
	const presenting = usePresentationStore((state) => state.presenting)
	const highContrast = usePresentationStore((state) => state.highContrast)
	const chromeHidden = usePresentationStore((state) => state.chromeHidden)
	const moreContrast = usePrefersMoreContrast()
	const contrast = highContrast || moreContrast

	useEffect(() => {
		setAttribute("data-presenting", presenting ? "" : null)
		setAttribute("data-contrast", contrast ? "high" : null)
		setAttribute("data-chrome", chromeHidden ? "hidden" : null)
		// text changed size: let the label layer re-measure, the canvas re-fit
		const frame = requestAnimationFrame(() =>
			window.dispatchEvent(new Event("resize")),
		)
		return () => cancelAnimationFrame(frame)
	}, [presenting, contrast, chromeHidden])

	useEffect(() => {
		if (presenting) preloadLazyPanels()
	}, [presenting])

	useEffect(
		() => () => {
			setAttribute("data-presenting", null)
			setAttribute("data-contrast", null)
			setAttribute("data-chrome", null)
		},
		[],
	)
}
