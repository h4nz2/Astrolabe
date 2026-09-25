import type { ReactNode } from "react"
import { Button, Group, Popover } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconStack2 } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { usePresentationStore } from "@/store/presentation"

import { PresentMenu, ShareMenu } from "./PresentMenu"

import classes from "./Presentation.module.css"

/** Phones: the HUD stacks over the scene, so the layer switches fold into a menu there too. */
const PHONE_QUERY = "(max-width: 599px)"

/** The layer switches sit in a menu while presenting and on phones, inline otherwise. */
function useFoldedLayers(): boolean {
	const presenting = usePresentationStore((state) => state.presenting)
	const phone = useMediaQuery(PHONE_QUERY) ?? false
	return presenting || phone
}

/**
 * The layer switches while presenting (#29): folded behind one button, so the
 * projector shows the solar system rather than a column of switches.
 */
function LayersMenu({ children }: { children: ReactNode }) {
	const { t } = useI18n()
	return (
		<Popover
			position="bottom-end"
			width={280}
			shadow="md"
			trapFocus
			returnFocus
		>
			<Popover.Target>
				<Button
					variant="subtle"
					color="gray"
					size="compact-sm"
					style={{ flexShrink: 0 }}
					leftSection={<IconStack2 size={16} aria-hidden />}
					aria-haspopup="dialog"
				>
					{t("solarSystem.present.layers")}
				</Button>
			</Popover.Target>
			<Popover.Dropdown>{children}</Popover.Dropdown>
		</Popover>
	)
}

/**
 * The top-right panel's header (#29): the teacher's menu, sharing and
 * whatever else is passed (the language menu); while presenting and on
 * phones, the layer switches too, folded into a menu (`layers`).
 */
export function TeacherBar({
	children,
	layers,
}: {
	children?: ReactNode
	layers?: ReactNode
}) {
	const folded = useFoldedLayers()
	return (
		<Group gap={4} justify="flex-end" wrap="wrap">
			{folded && layers !== undefined && <LayersMenu>{layers}</LayersMenu>}
			<PresentMenu />
			<ShareMenu />
			{children}
		</Group>
	)
}

/** The layer switches in the panel itself, unless presenting or on a phone (then they are in the bar's menu). */
export function InlineLayers({ children }: { children: ReactNode }) {
	const folded = useFoldedLayers()
	if (folded) return null
	return <div className={classes.layers}>{children}</div>
}
