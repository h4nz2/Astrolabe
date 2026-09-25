/**
 * The hover and selection rings over the scene (#16): hovering a body a click
 * would act on rings it and names it, so bodies visibly read as clickable, and
 * the selected body keeps a ring while it is too small to find. The rings are
 * placed every frame by `scene/HighlightTracker.tsx`; this only renders them
 * and the hovered body's name.
 */
import { useLayoutEffect, useRef } from "react"

import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"
import { useSimStore } from "@/store/sim"

import { highlightSlots } from "../scene/highlight"
import { isClickTarget } from "../scene/HoverCursor"
import { bodyClickAction } from "../scene/picking"

import classes from "./BodyHighlight.module.css"

/** What a click on the hovered body would do, for the caption; null while there is none. */
const hoverAction = (state: Parameters<typeof isClickTarget>[0]) =>
	state.hoverId !== null && isClickTarget(state)
		? bodyClickAction(state, state.hoverId)
		: null

const BodyHighlight = () => {
	const hoverRef = useRef<HTMLDivElement>(null)
	const selectionRef = useRef<HTMLDivElement>(null)
	const hoverId = useSimStore((state) => state.hoverId)
	const action = useSimStore(hoverAction)
	const { t } = useI18n()
	const name = useBodyName()

	useLayoutEffect(() => {
		highlightSlots.hover = hoverRef.current
		highlightSlots.selection = selectionRef.current
		return () => {
			highlightSlots.hover = null
			highlightSlots.selection = null
		}
	}, [])

	return (
		<div className={classes.layer} aria-hidden="true">
			<div
				ref={selectionRef}
				className={`${classes.ring} ${classes.selection}`}
				data-testid="selection-ring"
			/>
			<div
				ref={hoverRef}
				className={`${classes.ring} ${classes.hover}`}
				data-testid="hover-ring"
			>
				{hoverId !== null && action !== null && (
					<span className={classes.caption}>
						<span className={classes.name}>{name(hoverId)}</span>
						<span className={classes.hint}>
							{t(
								action === "reframe"
									? "solarSystem.pick.closer"
									: action === "select"
										? "solarSystem.pick.follow"
										: "solarSystem.pick.visit",
							)}
						</span>
					</span>
				)}
			</div>
		</div>
	)
}

export default BodyHighlight
