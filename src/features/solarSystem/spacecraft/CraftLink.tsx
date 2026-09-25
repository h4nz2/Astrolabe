import { useEffect } from "react"
import { useSearch } from "@tanstack/react-router"

import { spacecraftById } from "@/data/spacecraft"
import { useScaleStore } from "@/store/scale"

import { showCraft } from "./facts"
import { loadTrajectories } from "./trajectories"

/**
 * `?craft=voyager1` (the help page's "try it" link, #43): selects that
 * spacecraft (#35) on arrival and flies to it once its trajectory has loaded.
 * Like `?light=`, only an instruction: the URL mirror drops it, so a reload
 * or a shared view does not fly anywhere by itself.
 */
const CraftLink = () => {
	const requested = useSearch({
		from: "/solar_system",
		select: (search) => search.craft,
	})
	useEffect(() => {
		if (requested === undefined || !spacecraftById.has(requested)) return
		let live = true
		void loadTrajectories().then(() => {
			if (live) showCraft(requested, useScaleStore.getState().scale)
		})
		return () => {
			live = false
		}
	}, [requested])
	return null
}

export default CraftLink
