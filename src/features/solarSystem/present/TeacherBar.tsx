import type { ReactNode } from "react"
import { Button, Group, Popover } from "@mantine/core"
import { IconStack2 } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { usePresentationStore } from "@/store/presentation"

import { PresentMenu, ShareMenu } from "./PresentMenu"

import classes from "./Presentation.module.css"

/**
 * The layer switches while presenting (#29): folded behind one button, so the
 * projector shows the solar system rather than a column of switches.
 */
function LayersMenu({ children }: { children: ReactNode }) {
	const { t } = useI18n()
	return (
		<Popover position="bottom-end" shadow="md" trapFocus returnFocus>
			<Popover.Target>
				<Button
					variant="subtle"
					color="gray"
					size="compact-sm"
					style={{ flexShrink: 0 }}
					leftSection={<IconStack2 size={16} aria-hidden />}
					aria-haspopup="dialog"
				>
					{t("solarSystem.layers.label")}
				</Button>
			</Popover.Target>
			<Popover.Dropdown aria-label={t("solarSystem.layers.label")}>
				{children}
			</Popover.Dropdown>
		</Popover>
	)
}

/**
 * The top-right panel's header (#29): the teacher's menu, sharing and
 * whatever else is passed (the language menu); while presenting, the layer
 * switches too, folded into a menu (`layers`).
 */
export function TeacherBar({
	children,
	layers,
}: {
	children?: ReactNode
	layers?: ReactNode
}) {
	const presenting = usePresentationStore((state) => state.presenting)
	return (
		<Group gap={4} justify="flex-end" wrap="wrap">
			{presenting && layers !== undefined && <LayersMenu>{layers}</LayersMenu>}
			<PresentMenu />
			<ShareMenu />
			{children}
		</Group>
	)
}

/** The layer switches in the panel itself, unless presenting (then they are in the bar's menu). */
export function InlineLayers({ children }: { children: ReactNode }) {
	const presenting = usePresentationStore((state) => state.presenting)
	if (presenting) return null
	return <div className={classes.layers}>{children}</div>
}
