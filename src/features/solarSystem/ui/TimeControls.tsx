import {
	ActionIcon,
	Button,
	SegmentedControl,
	Select,
	Tooltip,
} from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import {
	IconPlayerPause,
	IconPlayerPlay,
	IconPlayerPlayFilled,
} from "@tabler/icons-react"

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
import { BirthdayButton } from "../birthday/Birthday"
import { SkyTonightButton } from "../skyTonight/SkyTonight"
import { HuntButton } from "../hunt/Hunt"
import TimeTravel from "./TimeTravel"
import TooFastHint from "./TooFastHint"
import {
	directionOf,
	stepWarp,
	warpLabel,
	withDirection,
	type Direction,
} from "./warp"

import classes from "./TimeControls.module.css"

/** Below this width the speed presets no longer fit in a row and become a Select. */
const COMPACT_QUERY = "(max-width: 719px)"

/**
 * Space toggles pause, "+" / "-" step to the next faster / slower preset in
 * the current direction. Text fields keep every key; buttons keep Space (they
 * toggle themselves when focused).
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

/** Runs the clock in `direction` at the current speed, un-pausing it. */
const play = (direction: Direction): void => {
	const { timeWarp, setTimeWarp, setPaused } = useSimStore.getState()
	setTimeWarp(withDirection(timeWarp, direction))
	setPaused(false)
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

/**
 * Reverse, pause and play as one group with exactly one of them pressed, so
 * the state of the clock reads at a glance.
 */
const Transport = () => {
	const paused = useSimStore((state) => state.paused)
	const direction = useSimStore((state) => directionOf(state.timeWarp))
	const togglePause = useSimStore((state) => state.togglePause)
	const { t } = useI18n()

	const reversing = !paused && direction === -1
	const playing = !paused && direction === 1
	return (
		<ActionIcon.Group aria-label={t("solarSystem.time.controls")}>
			<Tooltip label={t("solarSystem.time.reverseHint")} openDelay={400}>
				<ActionIcon
					variant={reversing ? "filled" : "default"}
					color="orange"
					size="lg"
					aria-label={t("solarSystem.time.reverse")}
					aria-pressed={reversing}
					onClick={() => play(-1)}
				>
					{reversing ? (
						<IconPlayerPlayFilled size={18} className={classes.flipped} />
					) : (
						<IconPlayerPlay size={18} className={classes.flipped} />
					)}
				</ActionIcon>
			</Tooltip>
			<Tooltip label={t("solarSystem.time.pauseHint")} openDelay={400}>
				<ActionIcon
					variant={paused ? "filled" : "default"}
					color="orange"
					size="lg"
					aria-label={t("solarSystem.time.pause")}
					aria-pressed={paused}
					onClick={togglePause}
				>
					<IconPlayerPause size={18} />
				</ActionIcon>
			</Tooltip>
			<Tooltip label={t("solarSystem.time.playHint")} openDelay={400}>
				<ActionIcon
					variant={playing ? "filled" : "default"}
					color="orange"
					size="lg"
					aria-label={t("solarSystem.time.play")}
					aria-pressed={playing}
					onClick={() => play(1)}
				>
					{playing ? (
						<IconPlayerPlayFilled size={18} />
					) : (
						<IconPlayerPlay size={18} />
					)}
				</ActionIcon>
			</Tooltip>
		</ActionIcon.Group>
	)
}

/**
 * The speed presets, slowest first: each step multiplies the speed, so the
 * row is a logarithmic scale. They set the speed only; the direction stays.
 */
const SpeedPresets = () => {
	const timeWarp = useSimStore((state) => state.timeWarp)
	const setTimeWarp = useSimStore((state) => state.setTimeWarp)
	const compact = useMediaQuery(COMPACT_QUERY, false, {
		getInitialValueInEffect: false,
	})
	const i18n = useI18n()
	const { t } = i18n

	const speed = Math.abs(timeWarp)
	const direction = directionOf(timeWarp)
	// a speed from the URL that is no preset still shows up as the selected item
	const values = [...WARP_PRESETS]
	if (!values.includes(speed)) values.push(speed)
	const items = values.map((value) => ({
		label: warpLabel(value, i18n),
		value,
	}))
	const choose = (value: number) => setTimeWarp(withDirection(value, direction))

	return compact ? (
		<Select
			size="xs"
			radius="md"
			aria-label={t("solarSystem.time.warp.label")}
			value={String(speed)}
			onChange={(value) => {
				if (value !== null) choose(Number(value))
			}}
			data={items.map((item) => ({
				label: item.label,
				value: String(item.value),
			}))}
			allowDeselect={false}
			comboboxProps={{ shadow: "md" }}
			className={classes.speedSelect}
		/>
	) : (
		<SegmentedControl<number>
			size="xs"
			radius="md"
			color="orange"
			aria-label={t("solarSystem.time.warp.label")}
			value={speed}
			onChange={choose}
			data={items}
		/>
	)
}

/**
 * The time controls (issue #14): reverse / pause / play, the date (a button
 * that opens the time travel panel), "Now", the speed presets and the
 * too-fast-to-follow hint.
 */
const TimeControls = () => {
	const setNow = useSimStore((state) => state.setNow)
	useWindowKeydown(handleKeyDown)
	const { t } = useI18n()

	return (
		<div className={classes.root}>
			<div className={classes.row}>
				<Transport />
				<TimeTravel>
					<SimDateTime />
				</TimeTravel>
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
				<BirthdayButton />
				<SkyTonightButton />
				<HuntButton />
			</div>
			<div className={classes.warp}>
				<SpeedPresets />
			</div>
			<TooFastHint />
		</div>
	)
}

export default TimeControls
