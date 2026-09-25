import type { ReactNode } from "react"
import { Button, Group, Popover } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconStack2 } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { Hint } from "@/primitives/hint"
import { usePresentationStore } from "@/store/presentation"

import { PresentMenu, ShareMenu } from "./PresentMenu"

import classes from "./Presentation.module.css"

/**
 * Below the wide layout (phones and 600-999 px) the HUD crowds the scene,
 * so the layer switches fold into a menu there too.
 */
const NARROW_QUERY = "(max-width: 999px)"

/** The layer switches sit in a menu while presenting and below 1000 px, inline otherwise. */
function useFoldedLayers(): boolean {
	const presenting = usePresentationStore((state) => state.presenting)
	const narrow = useMediaQuery(NARROW_QUERY) ?? false
	return presenting || narrow
}

/**
 * The layer switches while presenting (#29): folded behind one button, so the
 * projector shows the solar system rather than a column of switches.
 */
function LayersMenu({ children }: { children: ReactNode }) {
	const { t } = useI18n()
	return (
		<Hint text={t("solarSystem.present.layersHint")}>
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
		</Hint>
	)
}

/**
 * The top-right panel's header (#29): the teacher's menu, sharing and
 * whatever else is passed (the language menu); while presenting and on
 * narrow screens, the layer switches too, folded into a menu (`layers`).
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

/** The layer switches in the panel itself, unless presenting or on a narrow screen (then they are in the bar's menu). */
export function InlineLayers({ children }: { children: ReactNode }) {
	const folded = useFoldedLayers()
	if (folded) return null
	return <div className={classes.layers}>{children}</div>
}
