/**
 * The sky events, grouped by kind (#41): the list in the "Travel in time"
 * panel, which also holds the named moments of #14 (one list, not two).
 * Choosing an event stages it: time, scale, layers and a viewpoint.
 */
import {
	Badge,
	Group,
	ScrollArea,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core"

import { EVENT_GROUPS, eventsInGroup } from "@/data/skyEvents"
import { useI18n } from "@/i18n"

import { formatDayUTC } from "../ui/timeTravel"
import { startEvent } from "./player"
import { useEventWords } from "./text"

import classes from "./Events.module.css"

export interface EventListProps {
	/** Called after an event was chosen (closes the panel). */
	onChoose: () => void
	/** "Now", for marking the events still to come. */
	now?: Date
}

const EventList = ({ onChoose, now = new Date() }: EventListProps) => {
	const { t, formatLocale } = useI18n()
	const words = useEventWords()
	const today = now.toISOString()
	return (
		<ScrollArea.Autosize mah="min(24rem, 50dvh)" type="auto" offsetScrollbars>
			<nav aria-label={t("solarSystem.events.listLabel")}>
				<Stack gap="xs" className={classes.list}>
					{EVENT_GROUPS.map((group) => (
						<section key={group} aria-labelledby={`events-${group}`}>
							<Text
								component="h3"
								id={`events-${group}`}
								size="xs"
								fw={700}
								tt="uppercase"
								c="orange.4"
								className={classes.group}
							>
								{t(`solarSystem.events.groups.${group}`)}
							</Text>
							<Stack gap={2}>
								{eventsInGroup(group).map((event) => {
									const text = words(event.id)
									return (
										<UnstyledButton
											key={event.id}
											className={classes.item}
											data-event={event.id}
											data-moment={event.id}
											onClick={() => {
												startEvent(event.id)
												onChoose()
											}}
										>
											<Group
												gap="xs"
												justify="space-between"
												wrap="nowrap"
												align="baseline"
											>
												<Text size="sm" fw={600} className={classes.name}>
													{text.title}
												</Text>
												<Text size="xs" c="dimmed" className={classes.date}>
													{formatDayUTC(new Date(event.utc), formatLocale)}
												</Text>
											</Group>
											<Group gap={6} wrap="nowrap" align="baseline">
												{event.utc > today && (
													<Badge
														size="xs"
														variant="light"
														color="orange"
														className={classes.badge}
													>
														{t("solarSystem.events.upcoming")}
													</Badge>
												)}
												<Text size="xs" c="gray.5" lh={1.35}>
													{text.where}
												</Text>
											</Group>
										</UnstyledButton>
									)
								})}
							</Stack>
						</section>
					))}
				</Stack>
			</nav>
		</ScrollArea.Autosize>
	)
}

export default EventList
