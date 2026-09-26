/**
 * The quick look's script (#44): `src/data/quickLook.json`, validated. Every
 * step is a stop of the guided-tour format (#28), so the tour player plays it,
 * plus what that format cannot say: the one control that does it (`spot`), a
 * flash of light to send (`flash`, #27) and worlds to draw side by side in the
 * card (`compare`, #24).
 */
import { z } from "zod"

import { bodyById } from "@/data"
import quickLookData from "@/data/quickLook.json"
import { TourStop, type Tour } from "@/data/tours"

/** The id of the quick look as a tour (never in the tour menu, never in a link). */
export const QUICK_LOOK_ID = "quickLook"

/** The controls a step can point at: each glows while its step shows (`QuickLook.module.css`). */
export const SPOTS = [
	"picker",
	"scale",
	"time",
	"compare",
	"tools",
	"present",
	"help",
] as const
export type Spot = (typeof SPOTS)[number]

const knownBody = (id: string) => bodyById.has(id)

export const QuickLookStep = z
	.object({
		...TourStop.shape,
		/** The one control that does what the step shows. */
		spot: z.enum(SPOTS).optional(),
		/** Send a flash of light from this body when the step begins. */
		flash: z.string().refine(knownBody, "a body id").optional(),
		/** Draw these worlds side by side, at their true sizes, in the card. */
		compare: z
			.array(z.string().refine(knownBody, "a body id"))
			.min(2)
			.optional(),
	})
	.strict()

export const QuickLookFile = z
	.object({
		$comment: z.string().optional(),
		steps: z.array(QuickLookStep).min(2),
	})
	.strict()

export type QuickLookStep = z.infer<typeof QuickLookStep>

/** The steps, in order (the tests check the file). */
export const QUICK_LOOK_STEPS: readonly QuickLookStep[] =
	QuickLookFile.parse(quickLookData).steps

/**
 * The quick look as a tour: its stops without the extras. Leaving it goes
 * back to where the viewer was (`returnOnExit`), which after the opening is
 * the calm overview, now, at 1x.
 */
export function quickLookTour(
	steps: readonly QuickLookStep[] = QUICK_LOOK_STEPS,
): Tour {
	return {
		id: QUICK_LOOK_ID,
		order: Number.MAX_SAFE_INTEGER,
		returnOnExit: true,
		stops: steps.map(
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			({ spot, flash, compare, ...stop }) => stop,
		),
	}
}

/** The step of the quick look at `index` (its extras), if any. */
export const quickLookStep = (index: number): QuickLookStep | undefined =>
	QUICK_LOOK_STEPS[index]
