/**
 * Search params of `/compare?bodies=earth,jupiter&t=<jd>` (#24).
 *
 * Kept free of app imports (only zod and the solar system's own zod schema)
 * because the route module that validates the URL is loaded eagerly with the
 * route tree. Invalid values fall back to "absent": unknown body ids are
 * dropped when the list is read (`parseBodies`), a missing list shows the
 * default comparison, a missing `t` means the present.
 */
import { z } from "zod"

import { simSearchSchema } from "@/store/simSearch"

export const compareSearchSchema = z.object({
	// body ids, comma-separated; the first two are the pair the facts compare
	bodies: z.string().optional().catch(undefined),
	// the moment distances are measured at, as a Julian Date (absent: now);
	// the same rules as the solar system's `t`
	t: simSearchSchema.shape.t,
})

export type CompareSearch = z.output<typeof compareSearchSchema>
