import { createFileRoute } from "@tanstack/react-router"

import Help from "@/features/help"
import { helpSearchSchema } from "@/features/help/search"

// `/help?q=<search>&topic=<entry id>`: every feature, what it is, why and how,
// with a "try it" link each (#43); invalid values are dropped.
export const Route = createFileRoute("/help")({
	validateSearch: helpSearchSchema,
	component: Help,
})
