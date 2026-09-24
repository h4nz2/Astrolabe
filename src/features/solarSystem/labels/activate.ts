/**
 * What a tap on a label does: the hook the labels expose for the "click a body"
 * gesture (#16). A label is what a user aims at when the body is a speck, so by
 * default it does exactly what a tap on the body does today (`setFocus`: select
 * and fly there). #16 changes the gesture by passing its own handler to
 * `<Labels onActivate>` (scene/Scene.tsx) or by changing this default.
 */
import { useSimStore } from "@/store/sim"

/** Called with the id of the body whose label was tapped. */
export type LabelActivateHandler = (bodyId: string) => void

export const focusBodyFromLabel: LabelActivateHandler = (bodyId) =>
	useSimStore.getState().setFocus(bodyId)
