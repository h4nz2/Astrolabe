/**
 * Decides, once per arrival on the page, whether the opening plays (#30): a
 * first visit on this device, on a link that does not say where to look.
 * Rendered right after the URL sync, so a link's view is already applied and
 * a plain arrival starts from the seeded store. Leaving the page stops it.
 */
import { useLayoutEffect, useState } from "react"
import { useSearch } from "@tanstack/react-router"

import {
	cancelIntro,
	shouldPlayOnArrival,
	startIntro,
	watchIntro,
} from "./intro"

const IntroController = () => {
	const search = useSearch({ from: "/solar_system" })
	// decided from the URL the page was opened with, before anything writes to it;
	// `?intro=play` replays it on purpose (the help page's link, #43)
	const [play] = useState(
		() => search.intro === "play" || shouldPlayOnArrival(search),
	)

	useLayoutEffect(() => {
		const unwatch = watchIntro()
		if (play) startIntro()
		return () => {
			unwatch()
			cancelIntro()
		}
	}, [play])

	return null
}

export default IntroController
