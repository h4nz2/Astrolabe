import { createFileRoute } from "@tanstack/react-router"

import SolarSystem from "@/features/solarSystem"
import { simSearchSchema } from "@/store/simSearch"

// `/solar_system?focus=io&t=<jd>&warp=<n>` mirrors the simulation store (src/store/urlSync.ts);
// invalid values are dropped instead of throwing.
export const Route = createFileRoute("/solar_system")({
	validateSearch: simSearchSchema,
	component: SolarSystem,
})
