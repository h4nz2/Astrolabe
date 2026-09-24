import { useMemo } from "react"
import { Button } from "@mantine/core"
import { IconEraser, IconPinned, IconSun } from "@tabler/icons-react"

import { bodies, bodyById, sun } from "@/data"
import { useI18n, type I18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"
import { buildIndex } from "@/sim"
import { topLevelIndices } from "@/sim/referenceFrame"
import { isFrameAnchored } from "@/store/navigation"
import { useSimStore } from "@/store/sim"
import { useTrailStore } from "@/store/trails"

import useThrottledSimTime from "../scene/useThrottledSimTime"
import { insetGeometry, type InsetGeometry } from "./inset"
import { skyTarget } from "./presets"
import {
	apparentMotion,
	apparentRateDegPerDay,
	litPath,
	phaseOf,
	type Phase,
} from "./sky"
import { TRAIL_COLORS, TRAIL_DEFAULT_COLOR } from "./trails"

import classes from "./Frame.module.css"

const index = buildIndex(bodies)
const topIndex = topLevelIndices(bodies, index)
const sunIndex = index.get(sun.id) ?? 0
const colorOf = (i: number): string =>
	TRAIL_COLORS[bodies[i].id] ?? TRAIL_DEFAULT_COLOR

const INSET_RADIUS = 56
const PHASE_RADIUS = 30

/** The sky seen from the body held still, at `jd`: a phase for a body of the same family, else its motion and the map. */
export type FrameSky =
	| { kind: "phase"; observer: number; target: number; phase: Phase }
	| {
			kind: "motion"
			observer: number
			target: number
			rateDegPerDay: number
			inset: InsetGeometry
	  }

export function frameSky(
	frameId: string,
	selectedId: string | null,
	jd: number,
): FrameSky | null {
	const observer = index.get(frameId)
	const target = index.get(skyTarget(frameId, selectedId))
	if (observer === undefined || target === undefined || observer === target) {
		return null
	}
	if (topIndex[observer] === topIndex[target]) {
		return {
			kind: "phase",
			observer,
			target,
			phase: phaseOf({ bodies, index }, observer, target, sunIndex, jd),
		}
	}
	return {
		kind: "motion",
		observer,
		target,
		rateDegPerDay: apparentRateDegPerDay(
			{ bodies, index },
			observer,
			target,
			jd,
		),
		inset: insetGeometry(
			bodies,
			index,
			topIndex[observer],
			topIndex[target],
			jd,
			INSET_RADIUS,
		),
	}
}

function skyText(sky: FrameSky, i18n: I18n, name: (id: string) => string) {
	const { t } = i18n
	const body = name(bodies[sky.target].id)
	const observerId = bodies[sky.observer].id
	const observer = name(observerId)
	if (sky.kind === "phase") {
		const bodyId = bodies[sky.target].id
		return {
			caption: t("solarSystem.frame.phase.caption", {
				body,
				observer,
				observerId,
			}),
			status: t("solarSystem.frame.phase.status", {
				phase: t(`solarSystem.frame.phase.name.${sky.phase.id}`, { bodyId }),
				fraction: sky.phase.fraction,
			}),
		}
	}
	const motion = apparentMotion(sky.rateDegPerDay)
	const rate = `${i18n.significant(Math.abs(sky.rateDegPerDay), 2)}°`
	return {
		caption: null,
		status: t(`solarSystem.frame.motion.${motion}`, {
			body,
			observer,
			observerId,
			rate,
		}),
		motion,
	}
}

/** The Moon's (or any body's) face as the observer sees it. */
const PhaseDisc = ({ phase }: { phase: Phase }) => (
	<svg
		className={classes.phase}
		viewBox={`${-PHASE_RADIUS - 2} ${-PHASE_RADIUS - 2} ${2 * PHASE_RADIUS + 4} ${2 * PHASE_RADIUS + 4}`}
		aria-hidden
	>
		<circle r={PHASE_RADIUS} className={classes.phaseDark} />
		<path d={litPath(phase, PHASE_RADIUS)} className={classes.phaseLit} />
	</svg>
)

/** The same moment from above the Sun: both orbits and the line of sight. */
const InsetMap = ({
	sky,
	label,
	title,
}: {
	sky: Extract<FrameSky, { kind: "motion" }>
	label: string
	title: string
}) => {
	const { inset } = sky
	const r = inset.radius
	return (
		<figure className={classes.inset}>
			<svg
				viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`}
				role="img"
				aria-label={label}
				data-testid="frame-inset"
			>
				{inset.orbits.map((d, k) => (
					<path key={k} d={d} className={classes.insetOrbit} />
				))}
				<line
					x1={inset.observer.x}
					y1={inset.observer.y}
					x2={inset.sightEnd.x}
					y2={inset.sightEnd.y}
					className={classes.insetSight}
				/>
				<circle r={3.5} fill={TRAIL_COLORS.sun} />
				<circle
					cx={inset.observer.x}
					cy={inset.observer.y}
					r={3}
					fill={colorOf(topIndex[sky.observer])}
				/>
				<circle
					cx={inset.target.x}
					cy={inset.target.y}
					r={3}
					fill={colorOf(topIndex[sky.target])}
				/>
			</svg>
			<figcaption className={classes.insetTitle}>{title}</figcaption>
		</figure>
	)
}

/**
 * The permanent sign of an anchored frame (#31) and the way out: which body
 * is held still, what the lines are, the sky seen from it right now (a
 * planet's forwards or backwards motion next to a map from above the Sun, or
 * a moon's phase), "Restart the trails" and the unmissable "Back to
 * Sun-centred". Renders nothing in the Sun-centred frame.
 */
const FrameBadge = () => {
	const i18n = useI18n()
	const { t } = i18n
	const name = useBodyName()
	const frameId = useSimStore((state) => state.frameId)
	const selectedId = useSimStore((state) => state.selectedId)
	const releaseFrame = useSimStore((state) => state.releaseFrame)
	const sinceJD = useTrailStore((state) => state.sinceJD)
	const jd = useThrottledSimTime()
	const anchored = isFrameAnchored({ frameId })
	const sky = useMemo(
		() => (anchored ? frameSky(frameId, selectedId, jd) : null),
		[anchored, frameId, selectedId, jd],
	)
	if (!anchored || !bodyById.has(frameId)) return null

	const body = name(frameId)
	const text = sky === null ? null : skyText(sky, i18n, name)
	const restart = () =>
		useTrailStore.getState().restartTrails(useSimStore.getState().simTimeJD)

	return (
		<section
			className={classes.badge}
			aria-label={t("solarSystem.frame.badge.label")}
			data-testid="frame-badge"
		>
			<div className={classes.header}>
				<IconPinned className={classes.icon} size={20} aria-hidden />
				<span className={classes.title}>
					{t("solarSystem.frame.current.held", { bodyId: frameId, body })}
				</span>
				<Button
					className={classes.back}
					size="compact-sm"
					color="orange"
					leftSection={<IconSun size={16} aria-hidden />}
					onClick={() => releaseFrame()}
				>
					{t("solarSystem.frame.badge.back")}
				</Button>
			</div>
			<p className={classes.explain}>
				{t("solarSystem.frame.badge.explain", {
					bodyId: frameId,
					body,
					restarted: sinceJD === null ? "no" : "yes",
				})}
			</p>
			{sky !== null && text !== null && (
				<div className={classes.sky}>
					{sky.kind === "phase" ? (
						<PhaseDisc phase={sky.phase} />
					) : (
						<InsetMap
							sky={sky}
							title={t("solarSystem.frame.inset.title")}
							label={t("solarSystem.frame.inset.label", {
								observer: name(bodies[topIndex[sky.observer]].id),
								body: name(bodies[topIndex[sky.target]].id),
							})}
						/>
					)}
					<div className={classes.skyText}>
						{text.caption !== null && (
							<span className={classes.caption}>{text.caption}</span>
						)}
						<span
							className={classes.status}
							data-testid="frame-sky-status"
							data-motion={"motion" in text ? text.motion : undefined}
							data-phase={sky.kind === "phase" ? sky.phase.id : undefined}
						>
							{text.status}
						</span>
					</div>
				</div>
			)}
			<Button
				className={classes.restart}
				variant="subtle"
				color="gray"
				size="compact-xs"
				leftSection={<IconEraser size={14} aria-hidden />}
				onClick={restart}
			>
				{t("solarSystem.frame.badge.restart")}
			</Button>
		</section>
	)
}

export default FrameBadge
