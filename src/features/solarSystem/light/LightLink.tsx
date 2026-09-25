import { useLayoutEffect } from "react"
import { useSearch } from "@tanstack/react-router"

import { DEFAULT_EMITTER_ID, useLightStore } from "@/store/light"

/**
 * `?light=flash|delay|beyond` (the help page's "try it" links, #43): opens the
 * light panel (#27) on arrival, on the Flash tab with a flash already sent
 * from the Sun, or on the Signal delay or Farther out tab. Like `?birthday=true`
 * it is only an instruction: the URL mirror drops it, so a reload or a shared
 * view never sends another flash by itself.
 */
const LightLink = () => {
	const requested = useSearch({
		from: "/solar_system",
		select: (search) => search.light,
	})
	useLayoutEffect(() => {
		if (requested === undefined) return
		const light = useLightStore.getState()
		light.setOpen(true)
		if (requested === "flash") {
			light.setTab("pulse")
			light.send(DEFAULT_EMITTER_ID)
		} else {
			light.setTab(requested)
		}
	}, [requested])
	return null
}

export default LightLink
