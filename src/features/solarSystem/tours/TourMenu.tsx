/**
 * The way into the guided tours (#28): a "Tours" button beside the focus
 * picker opening the list of tours, each with the question it answers, its
 * number of stops and roughly how long it takes. Picking one starts it at
 * its first stop, advanced by hand (autoplay is a switch on the tour's card).
 */
import { useMemo } from "react"
import { Button, Menu, Text } from "@mantine/core"
import { IconRoute } from "@tabler/icons-react"

import { TOURS } from "@/data/tours"
import { useI18n } from "@/i18n"
import { Hint } from "@/primitives/hint"
import { useTourStore } from "@/store/tour"

import { tourDurationMs } from "./plan"
import { startTour } from "./player"
import { useTourWords } from "./text"

import classes from "./Tours.module.css"

const TourMenu = () => {
	const { t } = useI18n()
	const words = useTourWords()
	const activeId = useTourStore((state) => state.tour?.id ?? null)
	const tours = useMemo(
		() =>
			TOURS.map((tour) => ({
				tour,
				words: words.tour(tour),
				minutes: Math.max(
					1,
					Math.round(
						tourDurationMs(tour, (stop) => words.stop(tour, stop).text) /
							60_000,
					),
				),
			})),
		[words],
	)
	if (tours.length === 0) return null

	return (
		<Hint text={t("solarSystem.tours.menuHint")}>
			<Menu shadow="md" position="bottom-start" width={320}>
				<Menu.Target>
					<Button
						className={classes.menuButton}
						variant="subtle"
						color="gray"
						size="compact-sm"
						leftSection={<IconRoute size={16} aria-hidden />}
						aria-label={t("solarSystem.tours.menu")}
						data-testid="tour-menu"
					>
						<span className={classes.menuText}>
							{t("solarSystem.tours.menuShort")}
						</span>
					</Button>
				</Menu.Target>
				<Menu.Dropdown>
					<Menu.Label>{t("solarSystem.tours.menu")}</Menu.Label>
					{tours.map(({ tour, words: text, minutes }) => (
						<Menu.Item
							key={tour.id}
							onClick={() => startTour(tour)}
							aria-current={tour.id === activeId || undefined}
							data-tour={tour.id}
						>
							<Text size="sm" fw={600}>
								{text.title}
							</Text>
							<Text size="xs" c="dimmed">
								{text.summary}
							</Text>
							<Text size="xs" c="orange.4">
								{t("solarSystem.tours.meta", {
									count: tour.stops.length,
									minutes,
								})}
							</Text>
						</Menu.Item>
					))}
					<Menu.Divider />
					<Text size="xs" c="dimmed" px="sm" py={6}>
						{t("solarSystem.tours.keys")}
					</Text>
				</Menu.Dropdown>
			</Menu>
		</Hint>
	)
}

export default TourMenu
