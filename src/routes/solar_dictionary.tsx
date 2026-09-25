import { createFileRoute } from "@tanstack/react-router"

import SolarDictionary from "@/features/solarDictionary"
import { dictionarySearchSchema } from "@/features/solarDictionary/search"

// `/solar_dictionary?entity=3&texture=topo` (see features/solarDictionary/search.ts)
export const Route = createFileRoute("/solar_dictionary")({
	validateSearch: dictionarySearchSchema,
	component: SolarDictionary,
})
