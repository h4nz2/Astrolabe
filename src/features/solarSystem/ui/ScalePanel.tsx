import { useId } from "react"
import { Link } from "@tanstack/react-router"
import { Anchor, SegmentedControl, Text } from "@mantine/core"

import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"
import {
	SCALE_LIES,
	SCALE_PRESETS,
	presetForLies,
	type DistanceLie,
	type ScalePresetId,
	type SizeLie,
} from "@/sim"
import { useScaleStore } from "@/store/scale"
import { useSimStore } from "@/store/sim"

import { scaleSentences, statementSubject } from "./scaleStatement"

import classes from "./ScalePanel.module.css"

/**
 * The presets offered by name, from the truth to the most readable lie. The
 * fourth cell of the grid ("Big planets": enlarged sizes at real distances)
 * is reached through the separate Sizes / Distances switches.
 */
export const NAMED_PRESETS: readonly ScalePresetId[] = [
	"trueScale",
	"textbook",
	"everythingVisible",
]

/** Presets in which the planets are sub-pixel specks from the overview: the markers are what finds them. */
const SPECK_PRESETS: ReadonlySet<ScalePresetId> = new Set([
	"trueScale",
	"bigPlanets",
])

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/** Starts the animated switch; with reduced motion asked for, it jumps. */
export function switchScale(id: ScalePresetId): void {
	const reduced =
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia(REDUCED_MOTION_QUERY).matches
	useScaleStore
		.getState()
		.switchTo(id, performance.now(), reduced ? 0 : undefined)
}

/**
 * The scale picker (#21): the named presets, the two separate lies (sizes and
 * distances) each switchable on its own, and the honesty statement saying how
 * far from true the body in view is drawn. A teacher never types a number.
 */
const ScalePanel = () => {
	const { t } = useI18n()
	const name = useBodyName()
	const id = useId()
	const titleId = `${id}-title`
	const sizesId = `${id}-sizes`
	const distancesId = `${id}-distances`
	const targetId = useScaleStore((state) => state.targetId)
	// the chosen preset's numbers from the first frame of a switch; the live mix only for a custom scale
	const scale = useScaleStore((state) =>
		state.targetId === null ? state.scale : SCALE_PRESETS[state.targetId],
	)
	const selectedId = useSimStore((state) => state.selectedId)
	const focusId = useSimStore((state) => state.focusId)
	const showMarkers = useSimStore((state) => state.showMarkers)

	const subject = statementSubject(selectedId, focusId)
	const sentences = scaleSentences(subject, scale, name)
	// a custom mix (reachable only from the console) has no name and no cell in the grid
	const lies = targetId === null ? null : SCALE_LIES[targetId]

	const setSizes = (sizes: SizeLie) =>
		switchScale(
			presetForLies({ distances: lies?.distances ?? "squeezed", sizes }),
		)
	const setDistances = (distances: DistanceLie) =>
		switchScale(presetForLies({ sizes: lies?.sizes ?? "enlarged", distances }))

	return (
		<section
			className={classes.panel}
			aria-labelledby={titleId}
			data-scale-target={targetId ?? "custom"}
		>
			<Text id={titleId} className={classes.title} component="h2">
				{t("solarSystem.scale.label")}
			</Text>
			<SegmentedControl
				size="xs"
				fullWidth
				color="orange"
				aria-label={t("solarSystem.scale.presetsLabel")}
				className={classes.presets}
				value={
					targetId !== null && NAMED_PRESETS.includes(targetId) ? targetId : ""
				}
				onChange={(value) => switchScale(value as ScalePresetId)}
				data={NAMED_PRESETS.map((id) => ({
					value: id,
					label: t(`solarSystem.scale.preset.${id}`),
				}))}
			/>
			{targetId !== null && (
				<Text className={classes.summary} aria-live="polite">
					<strong>{t(`solarSystem.scale.preset.${targetId}`)}:</strong>{" "}
					{t(`solarSystem.scale.summary.${targetId}`)}
				</Text>
			)}
			<div className={classes.lie}>
				<span className={classes.lieLabel} id={sizesId}>
					{t("solarSystem.scale.sizes")}
				</span>
				<SegmentedControl
					size="xs"
					aria-labelledby={sizesId}
					value={lies?.sizes ?? ""}
					onChange={(value) => setSizes(value as SizeLie)}
					data={[
						{ value: "true", label: t("solarSystem.scale.sizesTrue") },
						{
							value: "enlarged",
							label: t("solarSystem.scale.sizesEnlarged"),
						},
					]}
				/>
				<Text className={classes.statement}>
					{t(sentences.size.key, sentences.size.values)}
				</Text>
			</div>
			<div className={classes.lie}>
				<span className={classes.lieLabel} id={distancesId}>
					{t("solarSystem.scale.distances")}
				</span>
				<SegmentedControl
					size="xs"
					aria-labelledby={distancesId}
					value={lies?.distances ?? ""}
					onChange={(value) => setDistances(value as DistanceLie)}
					data={[
						{ value: "true", label: t("solarSystem.scale.distancesTrue") },
						{
							value: "squeezed",
							label: t("solarSystem.scale.distancesSqueezed"),
						},
					]}
				/>
				{sentences.distance !== null && (
					<Text className={classes.statement}>
						{t(sentences.distance.key, sentences.distance.values)}
					</Text>
				)}
			</div>
			{targetId !== null && SPECK_PRESETS.has(targetId) && (
				<Text className={classes.hint}>
					{t(
						showMarkers
							? "solarSystem.scale.markersOn"
							: "solarSystem.scale.markersOff",
					)}
				</Text>
			)}
			{targetId === "trueScale" && (
				<Anchor component={Link} to="/solar_walk" className={classes.walk}>
					{t("solarSystem.scale.walk")}
				</Anchor>
			)}
		</section>
	)
}

export default ScalePanel
