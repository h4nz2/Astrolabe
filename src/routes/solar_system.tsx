import { createFileRoute, retainSearchParams } from "@tanstack/react-router"

import SolarSystem from "@/features/solarSystem"
import { simSearchSchema, type SimSearch } from "@/store/simSearch"

// `/solar_system?focus=io&t=<jd>&warp=<n>` mirrors the simulation store (src/store/urlSync.ts);
// invalid values are dropped instead of throwing.
export const Route = createFileRoute("/solar_system")({
	validateSearch: simSearchSchema,
	// the store mirror (urlSync.ts) writes whole searches without `hunt`; the
	// hunt panel alone sets or clears it (#34)
	search: { middlewares: [retainSearchParams<SimSearch>(["hunt"])] },
	component: SolarSystem,
})
