import { createFileRoute } from "@tanstack/react-router"

import Compare from "@/features/compare"
import { compareSearchSchema } from "@/features/compare/search"

// `/compare?bodies=earth,jupiter&t=<jd>`: bodies side by side at true
// relative size (#24); invalid values are dropped instead of throwing.
export const Route = createFileRoute("/compare")({
	validateSearch: compareSearchSchema,
	component: Compare,
})
