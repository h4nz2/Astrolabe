import {
	ActionIcon,
	Button,
	SegmentedControl,
	Select,
	Tooltip,
} from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react"

import { jdToDate } from "@/sim"
import { WARP_PRESETS, useSimStore } from "@/store/sim"

import { useThrottledSimTime } from "../scene/useThrottledSimTime"
import { formatUTC } from "./format"
import {
	hasModifier,
	isActivatableTarget,
	isEditableTarget,
	useWindowKeydown,
} from "./keyboard"
import { stepWarp, warpLabel } from "./warp"

import classes from "./TimeControls.module.css"

const presetItems = WARP_PRESETS.map((preset) => ({
	label: preset.label,
	value: preset.value,
}))

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

/** The simulation clock as text; its own component so the ~10 Hz updates re-render nothing else. */
const SimDateTime = () => {
	const jd = useThrottledSimTime()
	return <span className={classes.date}>{formatUTC(jdToDate(jd))}</span>
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

	// a warp from the URL that is no preset still shows up as the selected item
	const items = WARP_PRESETS.some((preset) => preset.value === timeWarp)
		? presetItems
		: [...presetItems, { label: warpLabel(timeWarp), value: timeWarp }]

	return (
		<div className={classes.root}>
			<div className={classes.row}>
				<Tooltip
					label={paused ? "Play (Space)" : "Pause (Space)"}
					openDelay={400}
				>
					<ActionIcon
						variant="filled"
						color="orange"
						size="lg"
						radius="xl"
						aria-label={paused ? "Play" : "Pause"}
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
				<Tooltip label="Jump to the current time" openDelay={400}>
					<Button
						variant="subtle"
						color="orange"
						size="compact-sm"
						onClick={setNow}
					>
						Now
					</Button>
				</Tooltip>
			</div>
			<div className={classes.warp}>
				{compact ? (
					<Select
						size="xs"
						radius="md"
						aria-label="Time warp"
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
						aria-label="Time warp"
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
