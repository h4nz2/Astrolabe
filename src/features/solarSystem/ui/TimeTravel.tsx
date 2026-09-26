import { Suspense, lazy, useState, type ReactNode } from "react"
import {
	Center,
	CloseButton,
	Group,
	Loader,
	Popover,
	SegmentedControl,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core"
import { IconCalendarEvent } from "@tabler/icons-react"

import { useI18n } from "@/i18n"

import classes from "./TimeTravel.module.css"

import EventList from "../events/EventList"

// the calendar (@mantine/dates) loads only when someone picks a date
const DayPicker = lazy(() => import("./DayPicker"))

type Tab = "moments" | "date"

export interface TimeTravelProps {
	/** The trigger's content: the HUD date. */
	children: ReactNode
}

/**
 * Jump to a date (issue #14): the HUD date is the button. It opens a panel
 * with the sky events (#41: the named moments are among them; an event sets
 * the whole scene, viewpoint included) and a calendar, which glides the clock
 * there and stops it on arrival (`travelAndStop`).
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
						<EventList onChoose={close} />
					) : (
						<Suspense
							fallback={
								<Center h={280}>
									<Loader size="sm" color="orange" />
								</Center>
							}
						>
							<DayPicker onTravel={close} />
						</Suspense>
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
