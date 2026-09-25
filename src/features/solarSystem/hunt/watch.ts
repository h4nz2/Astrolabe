/**
 * How a clue is answered (#34): by selecting the world in the scene, the same
 * way as always (a click or tap, a label, the picker; #16, #20). The hunt only
 * watches the selection; it never adds a picking mechanism of its own.
 */
import { applyFramePreset } from "../frame/presets"
import { useHuntStore } from "@/store/hunt"
import { useSimStore } from "@/store/sim"

import { guessOf, showPreset, solves, type HuntQuestion } from "./hunts"

/**
 * Watches the selection for `question` until the returned function is called.
 * A clue is solved when the view comes to solve it; a selection already in
 * place when the clue appears (the previous answer) is let go first, so the
 * same world can answer two clues in a row and every answer is a fresh
 * choice. A selection that does not solve it is only answered with kind
 * words (`setGuess`): nothing is counted.
 */
export function watchAnswers(
	question: HuntQuestion,
	sim = useSimStore,
	hunt = useHuntStore,
): () => void {
	if (solves(question, sim.getState())) sim.getState().select(null)
	let solved = false
	return sim.subscribe((state, previous) => {
		if (
			state.selectedId === previous.selectedId &&
			state.frameId === previous.frameId
		) {
			return
		}
		const now = solves(question, state)
		if (now && !solved && state.selectedId !== null) {
			hunt.getState().solve(state.selectedId)
		} else if (
			!now &&
			state.selectedId !== null &&
			state.selectedId !== previous.selectedId
		) {
			hunt.getState().setGuess({
				bodyId: state.selectedId,
				kind: guessOf(question, state.selectedId),
			})
		}
		solved = now
	})
}

/**
 * "Show me", after the last hint: flies to an answer (for a clue about a point
 * of view, switches to it, e.g. Mars seen from Earth), which solves the clue.
 */
export function showAnswer(question: HuntQuestion, sim = useSimStore): void {
	const preset = showPreset(question)
	if (preset !== null) {
		applyFramePreset(preset, sim.getState())
		return
	}
	const store = sim.getState()
	if (question.frame !== undefined) {
		store.anchorFrame(question.frame)
		sim.getState().select(question.answers[0])
		return
	}
	store.setFocus(question.answers[0])
}
