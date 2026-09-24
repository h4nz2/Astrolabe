import { ActionIcon, Tooltip } from "@mantine/core"
import { IconHome2 } from "@tabler/icons-react"

import { useSimStore } from "@/store/sim"

import { hasModifier, isEditableTarget, useWindowKeydown } from "./keyboard"

const LABEL = "Back to overview"

/** Escape is the way out from anywhere; an open dropdown or a text field keeps its own Escape. */
const handleKeyDown = (event: KeyboardEvent): void => {
	if (event.key !== "Escape") return
	if (hasModifier(event) || isEditableTarget(event.target)) return
	event.preventDefault()
	useSimStore.getState().reset()
}

/**
 * The always-available way out (Escape does the same): back to the overview
 * from any state, even mid-transition or mid-sequence, and the selection is
 * cleared, so a lesson can always restart from a known view.
 */
const OverviewButton = () => {
	useWindowKeydown(handleKeyDown)
	const reset = useSimStore((state) => state.reset)

	return (
		<Tooltip label={LABEL}>
			<ActionIcon
				variant="subtle"
				color="gray"
				size="lg"
				aria-label={LABEL}
				aria-keyshortcuts="Escape"
				onClick={reset}
			>
				<IconHome2 size={18} />
			</ActionIcon>
		</Tooltip>
	)
}

export default OverviewButton
