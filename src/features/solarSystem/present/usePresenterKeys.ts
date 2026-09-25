import { useEffect, useRef } from "react"

import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"
import { usePresentationStore } from "@/store/presentation"

import { runCommand, type CommandContext } from "./commands"
import { keyCommand } from "./keys"

/**
 * Where a key press belongs to the widget rather than to the presenter: text
 * fields and open lists. Unlike the HUD's own `isEditableTarget`, radio
 * buttons and switches do not count (they ignore letters and digits), so a
 * click on a speed preset never leaves the presenter's keys dead.
 */
const TEXT_ENTRY =
	"input:not([type='radio']):not([type='checkbox']):not([type='range']):not([type='button']), textarea, select, [contenteditable=''], [contenteditable='true'], [role='listbox'], [role='option'], [role='menu'], [role='menuitem']"

const inside = (target: EventTarget | null, selector: string): boolean =>
	target instanceof Element && target.closest(selector) !== null

/**
 * The presenter's keyboard (#29, keys.ts): listens on the window while the
 * page is mounted and announces what each key did through the live region.
 * Inside a modal dialog (the shortcut list, the class QR code) only "?"
 * counts, so the dialog keeps its own keys.
 */
export function usePresenterKeys(): void {
	const { t } = useI18n()
	const bodyName = useBodyName()
	const context = useRef<CommandContext>({ t, bodyName })
	useEffect(() => {
		context.current = { t, bodyName }
	}, [t, bodyName])

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || event.repeat) return
			if (inside(event.target, TEXT_ENTRY)) return
			const command = keyCommand(event)
			if (command === null) return
			if (
				command.kind !== "help" &&
				inside(event.target, "[role='dialog'][aria-modal='true']")
			) {
				return
			}
			event.preventDefault()
			const text = runCommand(command, context.current)
			if (text !== null) usePresentationStore.getState().announce(text)
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [])
}
