import { SegmentedControl, Select } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconRotate360 } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { Hint } from "@/primitives/hint"
import { MIN_SECONDS_PER_EARTH_TURN, SPIN_MODES, isSpinMode } from "@/sim"
import { useSpinStore } from "@/store/spin"

import classes from "./SpinControl.module.css"

/** Below this width the four modes become a Select, like the warp presets. */
const COMPACT_QUERY = "(max-width: 599px)"

/**
 * How fast the bodies spin, independently of the time warp (issue #13;
 * src/sim/spin.ts). Four named modes, "Realistic" first: one click restores the
 * true spin for the clock. Any other mode says, next to the control, that day and
 * night on the planets no longer match the date.
 */
const SpinControl = () => {
	const mode = useSpinStore((state) => state.mode)
	const setMode = useSpinStore((state) => state.setMode)
	const compact = useMediaQuery(COMPACT_QUERY, false, {
		getInitialValueInEffect: false,
	})
	const { t } = useI18n()

	const items = SPIN_MODES.map((value) => ({
		value,
		label: t(`solarSystem.spin.mode.${value}`),
	}))
	// what each mode does, on the mode itself (#39)
	const hints = Object.fromEntries(
		SPIN_MODES.map((value) => [
			value,
			t(`solarSystem.spin.hint.${value}`, {
				seconds: MIN_SECONDS_PER_EARTH_TURN[value],
			}),
		]),
	)
	const onChange = (value: string | null) => {
		if (isSpinMode(value)) setMode(value)
	}

	return (
		<div className={classes.root}>
			<div className={classes.row}>
				<span className={classes.label} aria-hidden>
					<IconRotate360 size={16} />
					{t("solarSystem.spin.label")}
				</span>
				{compact ? (
					<Hint text={hints[mode]}>
						<Select
							size="xs"
							radius="md"
							aria-label={t("solarSystem.spin.label")}
							value={mode}
							onChange={onChange}
							data={items}
							allowDeselect={false}
							comboboxProps={{ shadow: "md" }}
						/>
					</Hint>
				) : (
					<Hint options={hints}>
						<SegmentedControl
							size="xs"
							radius="md"
							color="orange"
							aria-label={t("solarSystem.spin.label")}
							value={mode}
							onChange={onChange}
							data={items}
						/>
					</Hint>
				)}
			</div>
			{mode !== "realistic" && (
				<p className={classes.notice} role="status">
					{t("solarSystem.spin.notice")}
				</p>
			)}
		</div>
	)
}

export default SpinControl
