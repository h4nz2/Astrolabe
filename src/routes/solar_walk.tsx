import { createFileRoute } from "@tanstack/react-router"

import SolarWalk from "@/features/solarWalk"
import { solarWalkSearchSchema } from "@/features/solarWalk/search"

// `/solar_walk?sun=orange&landmark=track&view=table` (#25); defaults are left
// out of the URL and invalid values fall back to them instead of throwing.
export const Route = createFileRoute("/solar_walk")({
	validateSearch: solarWalkSearchSchema,
	component: SolarWalk,
})
