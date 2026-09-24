import {
	ActionIcon,
	Button,
	SegmentedControl,
	Select,
	Tooltip,
} from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react"

import { isoMinuteUTC, useI18n } from "@/i18n"
import { jdToDate } from "@/sim"
import { WARP_PRESETS, useSimStore } from "@/store/sim"

import { useThrottledSimTime } from "../scene/useThrottledSimTime"
import {
	hasModifier,
	isActivatableTarget,
	isEditableTarget,
	useWindowKeydown,
} from "./keyboard"
import { stepWarp, warpLabel } from "./warp"

import classes from "./TimeControls.module.css"

/** Below this width the seven presets no longer fit in a row and become a Select. */
const COMPACT_QUERY = "(max-width: 599px)"

/**
 * Space toggles pause, "+" / "-" step through the warp presets. Text fields
 * keep every key; buttons keep Space (they toggle themselves when focused).
 */
const handleKeyDown = (event: KeyboardEvent): void => {
	if (hasModifier(event) || isEditableTarget(event.target)) return
	const { timeWarp, togglePause, setTimeWarp } = useSimStore.getState()
	switch (event.key) {
		case " ":
			if (event.repeat || isActivatableTarget(event.target)) return
			event.preventDefault()
			togglePause()
			return
		case "+":
		case "=":
			event.preventDefault()
			setTimeWarp(stepWarp(timeWarp, 1))
			return
		case "-":
		case "_":
			event.preventDefault()
			setTimeWarp(stepWarp(timeWarp, -1))
			return
		default:
			return
	}
}

/**
 * The simulation clock in the active locale's date format, with the ISO
 * instant in `dateTime`; its own component so the ~10 Hz updates re-render nothing else.
 */
const SimDateTime = () => {
	const jd = useThrottledSimTime()
	const { dateTimeUTC } = useI18n()
	const date = jdToDate(jd)
	return (
		<time className={classes.date} dateTime={isoMinuteUTC(date)}>
			{dateTimeUTC(date)}
		</time>
	)
}

/** Play/pause, the warp presets, the current UTC date and a jump to the wall clock. */
const TimeControls = () => {
	const paused = useSimStore((state) => state.paused)
	const timeWarp = useSimStore((state) => state.timeWarp)
	const togglePause = useSimStore((state) => state.togglePause)
	const setTimeWarp = useSimStore((state) => state.setTimeWarp)
	const setNow = useSimStore((state) => state.setNow)
	const compact = useMediaQuery(COMPACT_QUERY, false, {
		getInitialValueInEffect: false,
	})
	useWindowKeydown(handleKeyDown)
	const i18n = useI18n()
	const { t } = i18n

	// a warp from the URL that is no preset still shows up as the selected item
	const values = WARP_PRESETS.map((preset) => preset.value)
	if (!values.includes(timeWarp)) values.push(timeWarp)
	const items = values.map((value) => ({
		label: warpLabel(value, i18n),
		value,
	}))

	return (
		<div className={classes.root}>
			<div className={classes.row}>
				<Tooltip
					label={
						paused
							? t("solarSystem.time.playHint")
							: t("solarSystem.time.pauseHint")
					}
					openDelay={400}
				>
					<ActionIcon
						variant="filled"
						color="orange"
						size="lg"
						radius="xl"
						aria-label={
							paused ? t("solarSystem.time.play") : t("solarSystem.time.pause")
						}
						onClick={togglePause}
					>
						{paused ? (
							<IconPlayerPlay size={18} />
						) : (
							<IconPlayerPause size={18} />
						)}
					</ActionIcon>
				</Tooltip>
				<SimDateTime />
				<Tooltip label={t("solarSystem.time.nowHint")} openDelay={400}>
					<Button
						variant="subtle"
						color="orange"
						size="compact-sm"
						onClick={setNow}
					>
						{t("solarSystem.time.now")}
					</Button>
				</Tooltip>
			</div>
			<div className={classes.warp}>
				{compact ? (
					<Select
						size="xs"
						radius="md"
						aria-label={t("solarSystem.time.warp.label")}
						value={String(timeWarp)}
						onChange={(value) => {
							if (value !== null) setTimeWarp(Number(value))
						}}
						data={items.map((item) => ({
							label: item.label,
							value: String(item.value),
						}))}
						allowDeselect={false}
						comboboxProps={{ shadow: "md" }}
					/>
				) : (
					<SegmentedControl<number>
						size="xs"
						radius="md"
						color="orange"
						aria-label={t("solarSystem.time.warp.label")}
						value={timeWarp}
						onChange={setTimeWarp}
						data={items}
					/>
				)}
			</div>
		</div>
	)
}

export default TimeControls
