/**
 * The label names as DOM text over the Canvas (docs/ARCHITECTURE.md, "Labels"):
 * crisp at any resolution, translated through `@/i18n/bodies`, styled by CSS.
 * One element per body is rendered once (and again only when the language, the
 * Labels switch, the hover or the selection changes), plus one per orbit while
 * the orbit names are on; ./Labels.tsx positions and fades them every frame.
 * The layer never takes pointer events: picking goes through the scene
 * (Labels.tsx), so a drag on a label still orbits.
 * `aria-hidden`: the names are a visual aid, the focus picker is the
 * accessible way to reach every body.
 */
import { useLayoutEffect } from "react"

import { bodies } from "@/data"
import { useBodyName } from "@/i18n/bodies"
import { useSimStore } from "@/store/sim"

import { attachLabel, measureLabels, type LabelBoard } from "./board"
import { orbitSlot } from "./project"

import classes from "./Labels.module.css"

export interface LabelLayerProps {
	board: LabelBoard
}

function LabelLayer({ board }: LabelLayerProps) {
	const name = useBodyName()
	const showLabels = useSimStore((state) => state.showLabels)
	const selectedId = useSimStore((state) => state.selectedId)
	const hoverId = useSimStore((state) => state.hoverId)
	const orbitNames = useSimStore(
		(state) => state.showOrbits && state.showOrbitLabels,
	)
	const n = bodies.length

	// sizes change with the language and once the web font has loaded
	useLayoutEffect(() => {
		if (!showLabels) return
		measureLabels(board)
		let live = true
		void document.fonts?.ready.then(() => {
			if (live) measureLabels(board)
		})
		return () => {
			live = false
		}
	}, [board, name, showLabels, orbitNames])

	return (
		<div className={classes.layer} aria-hidden hidden={!showLabels}>
			{bodies.map((body, i) => (
				<span
					key={body.id}
					ref={(element) => {
						attachLabel(board, i, element)
					}}
					className={classes.label}
					data-body={body.id}
					data-kind={body.kind}
					data-selected={body.id === selectedId || undefined}
					data-hovered={body.id === hoverId || undefined}
				>
					{name(body.id)}
				</span>
			))}
			{orbitNames &&
				bodies.map((body, i) =>
					body.orbit === null ? null : (
						<span
							key={`orbit-${body.id}`}
							ref={(element) => {
								attachLabel(board, orbitSlot(i, n), element)
							}}
							className={`${classes.label} ${classes.orbit}`}
							data-orbit={body.id}
							data-kind={body.kind}
							data-hovered={body.id === hoverId || undefined}
						>
							{name(body.id)}
						</span>
					),
				)}
		</div>
	)
}

export default LabelLayer
