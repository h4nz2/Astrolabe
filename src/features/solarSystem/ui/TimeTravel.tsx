import { useState, type ReactNode } from "react"
import {
	CloseButton,
	Group,
	Popover,
	ScrollArea,
	SegmentedControl,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core"
import { DatePicker } from "@mantine/dates"
import { IconCalendarEvent } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { useSimStore } from "@/store/sim"

import { MOMENTS, momentJD } from "./moments"
import {
	FIRST_DAY,
	LAST_DAY,
	arrivalJD,
	calendarLabels,
	dayOf,
	firstDayOfWeek,
	formatDayUTC,
	travelAndStop,
} from "./timeTravel"

import "@mantine/dates/styles.css"
import classes from "./TimeTravel.module.css"

type Tab = "moments" | "date"

export interface TimeTravelProps {
	/** The trigger's content: the HUD date. */
	children: ReactNode
}

/** The named moments, earliest first; a click travels there and closes the panel. */
const MomentList = ({ onTravel }: { onTravel: () => void }) => {
	const { t, formatLocale } = useI18n()
	return (
		<ScrollArea.Autosize mah="min(22rem, 45dvh)" type="auto" offsetScrollbars>
			<Stack gap={2} className={classes.moments}>
				{MOMENTS.map((moment) => (
					<UnstyledButton
						key={moment.id}
						className={classes.moment}
						data-moment={moment.id}
						onClick={() => {
							travelAndStop(momentJD(moment))
							onTravel()
						}}
					>
						<Group
							gap="xs"
							justify="space-between"
							wrap="nowrap"
							align="baseline"
						>
							<Text size="sm" fw={600} className={classes.momentName}>
								{t(`solarSystem.time.moments.${moment.id}.name`)}
							</Text>
							<Text size="xs" c="dimmed" className={classes.momentDate}>
								{formatDayUTC(new Date(moment.iso), formatLocale)}
							</Text>
						</Group>
						<Text size="xs" c="gray.5" lh={1.35}>
							{t(`solarSystem.time.moments.${moment.id}.description`)}
						</Text>
					</UnstyledButton>
				))}
			</Stack>
		</ScrollArea.Autosize>
	)
}

/** A calendar on the simulation's day; picking a day travels to its noon (UTC). */
const DayPicker = ({ onTravel }: { onTravel: () => void }) => {
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

/**
 * Jump to a date (issue #14): the HUD date is the button. It opens a panel
 * with named moments and a calendar; either one glides the clock there and
 * stops it on arrival (`travelAndStop`).
 */
const TimeTravel = ({ children }: TimeTravelProps) => {
	const { t } = useI18n()
	const [opened, setOpened] = useState(false)
	const [tab, setTab] = useState<Tab>("moments")
	const close = () => setOpened(false)

	return (
		<Popover
			opened={opened}
			onChange={setOpened}
			position="top"
			width={340}
			shadow="md"
			radius="md"
			trapFocus
			returnFocus
		>
			<Popover.Target>
				<UnstyledButton
					className={classes.trigger}
					aria-label={t("solarSystem.time.travel.open")}
					aria-haspopup="dialog"
					aria-expanded={opened}
					title={t("solarSystem.time.travel.open")}
					onClick={() => setOpened((open) => !open)}
				>
					<IconCalendarEvent size={16} className={classes.icon} />
					{children}
				</UnstyledButton>
			</Popover.Target>
			<Popover.Dropdown
				className={classes.dropdown}
				aria-label={t("solarSystem.time.travel.title")}
			>
				<Stack gap="xs">
					<Group justify="space-between" wrap="nowrap">
						<Text fw={700} size="sm">
							{t("solarSystem.time.travel.title")}
						</Text>
						<CloseButton
							size="sm"
							aria-label={t("solarSystem.time.travel.close")}
							onClick={close}
						/>
					</Group>
					<SegmentedControl<Tab>
						fullWidth
						size="xs"
						radius="md"
						value={tab}
						onChange={setTab}
						data={[
							{ value: "moments", label: t("solarSystem.time.travel.moments") },
							{ value: "date", label: t("solarSystem.time.travel.pickDate") },
						]}
					/>
					{tab === "moments" ? (
						<MomentList onTravel={close} />
					) : (
						<DayPicker onTravel={close} />
					)}
					<Text size="xs" c="dimmed" ta="center">
						{t("solarSystem.time.travel.arrival")}
					</Text>
				</Stack>
			</Popover.Dropdown>
		</Popover>
	)
}

export default TimeTravel
