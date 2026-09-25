/**
 * The scavenger hunt (#34): clues a class solves by finding a world in the
 * scene and selecting it. Pure: the question bank and the hunts, how a hunt is
 * named in a link, and what a selection means for the clue being asked.
 *
 * The bank is data (`src/data/hunts.json`: ids, answers, hunts), the words are
 * content (`src/locales/<locale>/hunts.json`, see `text.ts`), so a teacher adds
 * a clue or a whole hunt by editing those files alone. `hunts.test.ts` is the
 * contract: answers are real bodies, every clue has its words in every locale.
 */
import { z } from "zod"

import { bodyById } from "@/data"
import huntsJson from "@/data/hunts.json"

import {
	FRAME_PRESETS,
	FRAME_PRESET_IDS,
	type FramePresetId,
} from "../frame/presets"

export const DIFFICULTIES = ["easy", "medium", "hard"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

const id = z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/)

export const HuntQuestion = z
	.object({
		/** Also the key of the clue's words in every locale's hunts.json. */
		id,
		/** Body ids that answer the clue; selecting any of them solves it. */
		answers: z.array(z.string()).min(1),
		/**
		 * The body that must be held still (#31) while the answer is selected:
		 * "earth" for a clue about how the sky looks from Earth.
		 */
		frame: z.string().optional(),
	})
	.strict()
export type HuntQuestion = z.infer<typeof HuntQuestion>

export const Hunt = z
	.object({
		id,
		difficulty: z.enum(DIFFICULTIES),
		/** Question ids in the order they are asked. */
		questions: z.array(id).min(1),
	})
	.strict()
export type Hunt = z.infer<typeof Hunt>

export const HuntFile = z
	.object({ questions: z.array(HuntQuestion), hunts: z.array(Hunt) })
	.strict()
export type HuntFile = z.infer<typeof HuntFile>

/** The bank as committed (validated by hunts.test.ts rather than at load). */
export const huntFile: HuntFile = huntsJson as HuntFile

export const QUESTIONS: readonly HuntQuestion[] = huntFile.questions
export const questionById: ReadonlyMap<string, HuntQuestion> = new Map(
	QUESTIONS.map((question) => [question.id, question]),
)
/** The ready-made hunts, in menu order. */
export const HUNTS: readonly Hunt[] = huntFile.hunts
export const huntById: ReadonlyMap<string, Hunt> = new Map(
	HUNTS.map((hunt) => [hunt.id, hunt]),
)

/** Joins the question ids of a hunt a teacher put together (`?hunt=geysers.oceanMoon`). */
export const CUSTOM_SEPARATOR = "."

/** A hunt ready to play: a ready-made one (`id`) or one put together from the bank (`id` null). */
export interface ResolvedHunt {
	/** What the link carries: the hunt's id, or its question ids joined by ".". */
	key: string
	id: string | null
	difficulty: Difficulty | null
	questions: readonly HuntQuestion[]
}

/**
 * The hunt a link names: a ready-made hunt's id, or question ids joined by
 * "." in the order they are asked (unknown ids are skipped, repeats dropped);
 * null when nothing is left.
 */
export function resolveHunt(
	key: string | undefined | null,
): ResolvedHunt | null {
	if (key == null || key === "") return null
	const hunt = huntById.get(key)
	if (hunt !== undefined) {
		return {
			key,
			id: hunt.id,
			difficulty: hunt.difficulty,
			questions: hunt.questions.flatMap((qid) => questionById.get(qid) ?? []),
		}
	}
	const ids = [...new Set(key.split(CUSTOM_SEPARATOR))].filter((qid) =>
		questionById.has(qid),
	)
	if (ids.length === 0) return null
	return {
		key: ids.join(CUSTOM_SEPARATOR),
		id: null,
		difficulty: null,
		questions: ids.map((qid) => questionById.get(qid)!),
	}
}

/** The link key of a hunt made of these questions (the builder's ticks), in the bank's order. */
export const customHuntKey = (ids: Iterable<string>): string => {
	const chosen = new Set(ids)
	return QUESTIONS.filter((question) => chosen.has(question.id))
		.map((question) => question.id)
		.join(CUSTOM_SEPARATOR)
}

/** What the hunt watches: the selection, and which body is held still (#31). */
export interface HuntView {
	selectedId: string | null
	frameId: string
}

/** Whether the view answers the clue: an answer is selected (with its frame held still). */
export const solves = (question: HuntQuestion, view: HuntView): boolean =>
	view.selectedId !== null &&
	question.answers.includes(view.selectedId) &&
	(question.frame === undefined || view.frameId === question.frame)

/**
 * What to say about a selection that does not solve the clue, never a
 * penalty: "almost" (the right world, not yet seen from the clue's frame),
 * "warm" (the planet of a moon that answers it) or "other".
 */
export type Guess = "almost" | "warm" | "other"

export function guessOf(question: HuntQuestion, bodyId: string): Guess {
	if (question.answers.includes(bodyId)) return "almost"
	const isParentPlanet =
		bodyById.get(bodyId)?.kind === "planet" &&
		question.answers.some((answer) => bodyById.get(answer)?.parentId === bodyId)
	return isParentPlanet ? "warm" : "other"
}

/**
 * The point of view (#31) "Show me" uses for a clue with a frame: a preset
 * holding that body still and selecting one of the answers (Mars from Earth).
 */
export function showPreset(question: HuntQuestion): FramePresetId | null {
	if (question.frame === undefined) return null
	return (
		FRAME_PRESET_IDS.find((presetId) => {
			const preset = FRAME_PRESETS[presetId]
			return (
				preset.anchorId === question.frame &&
				preset.selectId !== null &&
				question.answers.includes(preset.selectId)
			)
		}) ?? null
	)
}
