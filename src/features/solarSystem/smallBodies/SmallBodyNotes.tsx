/**
 * What the HUD card says about small bodies (#23): a belt's honesty note (each dot
 * stands for hundreds of asteroids, and they are a million km apart), the legend in the
 * overview while the "Small bodies" layer is on, and a comet's live state with the
 * "Watch it pass the Sun" button.
 */
import { useMemo } from "react"
import { Button } from "@mantine/core"
import { IconComet } from "@tabler/icons-react"

import { belts, type Belt, type Body } from "@/data"
import { useI18n } from "@/i18n"
import { useSimStore } from "@/store/sim"

import useThrottledSimTime from "../scene/useThrottledSimTime"
import { watchComet } from "./cometWatch"
import { beltOf, beltSentences, cometSentences } from "./smallBodyText"

import classes from "./SmallBodyNotes.module.css"

/** A belt's name and what its dots do and do not show. */
export function BeltNote({
	belt,
	compact = false,
}: {
	belt: Belt
	compact?: boolean
}) {
	const i18n = useI18n()
	const text = useMemo(() => beltSentences(belt, i18n), [belt, i18n])
	return (
		<div className={classes.note} data-testid="belt-note" data-belt={belt.id}>
			<p className={classes.title}>{text.name}</p>
			<p>{text.perDot}</p>
			<p>{text.spacing}</p>
			{!compact && <p className={classes.aside}>{text.dotSize}</p>}
		</div>
	)
}

/** The overview's legend while the small bodies are shown: the asteroid belt's note and a line on the Kuiper belt. */
export function SmallBodiesLegend() {
	const { t } = useI18n()
	const show = useSimStore((state) => state.showSmallBodies)
	const asteroidBelt = belts[0]
	if (!show || asteroidBelt === undefined) return null
	return (
		<div data-testid="small-bodies-legend">
			<BeltNote belt={asteroidBelt} compact />
			<p className={classes.aside}>
				{t("solarSystem.smallBodies.legendKuiper")}
			</p>
		</div>
	)
}

/** A comet right now: where it is, its tail, its next perihelion; and the way to watch one. */
export function CometNote({ body }: { body: Body }) {
	const i18n = useI18n()
	const jd = useThrottledSimTime()
	const text = cometSentences(body, jd, i18n)
	if (text === null) return null
	return (
		<div className={classes.note} data-testid="comet-note">
			<p>{text.where}</p>
			<p data-testid="comet-tail">{text.tail}</p>
			<p className={classes.aside}>{text.perihelion}</p>
			<Button
				size="xs"
				variant="light"
				color="orange"
				leftSection={<IconComet size={16} aria-hidden />}
				onClick={() => watchComet(body)}
			>
				{i18n.t("solarSystem.smallBodies.comet.watch")}
			</Button>
		</div>
	)
}

/** The small-body part of a body's card: the comet's state, or the belt it lives in. */
export function SmallBodyNotes({ body }: { body: Body }) {
	if (body.tail !== undefined) return <CometNote body={body} />
	const belt = beltOf(body)
	return belt === null ? null : <BeltNote belt={belt} />
}

export default SmallBodyNotes
