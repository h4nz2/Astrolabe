import { useState } from "react"
import { Stack, Text } from "@mantine/core"
import { DatePicker } from "@mantine/dates"

import { useI18n } from "@/i18n"
import { useSimStore } from "@/store/sim"

import {
	FIRST_DAY,
	LAST_DAY,
	arrivalJD,
	calendarLabels,
	dayOf,
	firstDayOfWeek,
	travelAndStop,
} from "./timeTravel"

import "@mantine/dates/styles.css"

export interface DayPickerProps {
	/** Called after a day was picked and the travel started. */
	onTravel: () => void
}

/** A calendar on the simulation's day; picking a day travels to its noon (UTC). */
const DayPicker = ({ onTravel }: DayPickerProps) => {
	const { t, formatLocale } = useI18n()
	// read once when the calendar opens: it must not page along with a running clock
	const [today] = useState(() => dayOf(useSimStore.getState().simTimeJD))
	const labels = calendarLabels(formatLocale)
	return (
		<Stack gap="xs" align="center">
			<DatePicker
				value={today}
				defaultDate={today}
				minDate={FIRST_DAY}
				maxDate={LAST_DAY}
				firstDayOfWeek={firstDayOfWeek(formatLocale)}
				// which days count as the weekend differs by country; none are marked
				weekendDays={[]}
				{...labels}
				ariaLabels={{
					nextMonth: t("solarSystem.time.travel.calendar.nextMonth"),
					previousMonth: t("solarSystem.time.travel.calendar.previousMonth"),
					nextYear: t("solarSystem.time.travel.calendar.nextYear"),
					previousYear: t("solarSystem.time.travel.calendar.previousYear"),
					nextDecade: t("solarSystem.time.travel.calendar.nextDecade"),
					previousDecade: t("solarSystem.time.travel.calendar.previousDecade"),
					monthLevelControl: t("solarSystem.time.travel.calendar.monthLevel"),
					yearLevelControl: t("solarSystem.time.travel.calendar.yearLevel"),
				}}
				onChange={(day) => {
					if (day === null) return
					travelAndStop(arrivalJD(day))
					onTravel()
				}}
			/>
			<Text size="xs" c="dimmed" ta="center">
				{t("solarSystem.time.travel.range", {
					first: labels.yearLabelFormat(FIRST_DAY),
					last: labels.yearLabelFormat(LAST_DAY),
				})}
			</Text>
		</Stack>
	)
}

export default DayPicker
