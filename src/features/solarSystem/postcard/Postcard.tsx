import { Suspense, lazy, useLayoutEffect } from "react"
import { ActionIcon, Tooltip } from "@mantine/core"
import { IconCamera } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { usePostcardStore } from "@/store/postcard"

import { takePostcard } from "./take"

// the dialog (and the QR encoder behind it) loads with the first picture
const PostcardDialog = lazy(() => import("./PostcardDialog"))

/**
 * "Take a picture" (#33): one click takes the view as it is on screen, with
 * no HUD, and opens the postcard to save, copy or share it.
 */
export const PostcardButton = () => {
	const { t } = useI18n()
	const label = t("solarSystem.postcard.take")
	return (
		<Tooltip label={t("solarSystem.postcard.takeHint")} openDelay={400}>
			<ActionIcon
				variant="subtle"
				color="gray"
				size="lg"
				aria-label={label}
				aria-haspopup="dialog"
				onClick={() => takePostcard()}
			>
				<IconCamera size={18} />
			</ActionIcon>
		</Tooltip>
	)
}

/** The postcard dialog's place on the page: nothing until a picture is taken. */
export const PostcardSlot = () => {
	const open = usePostcardStore((state) => state.snapshot !== null)
	// leaving the page drops the picture
	useLayoutEffect(() => () => usePostcardStore.getState().close(), [])
	if (!open) return null
	return (
		<Suspense fallback={null}>
			<PostcardDialog />
		</Suspense>
	)
}
