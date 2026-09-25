/**
 * The flight readout (#18): the educational payload of a flight between two
 * bodies. It names the trip, gives its TRUE distance ("628 million km apart
 * on this date"), counts the kilometres crossed while the camera flies, and
 * says how long light, the fastest spacecraft launch ever and a car would take
 * (`flightFacts.ts`). It appears when a flight departs, offers Skip while it
 * runs, and stays after the arrival until the view moves on or it is closed,
 * so a class can read it and a teacher can talk about it.
 *
 * Reads the flight record (`src/store/flight.ts`), never the camera; the
 * counter and the bar are written straight to the DOM once per animation
 * frame while the flight runs, never through React state.
 */
import { useEffect, useMemo, useRef } from "react"
import { Button, CloseButton } from "@mantine/core"
import {
	IconBulb,
	IconCar,
	IconPlayerTrackNext,
	IconRocket,
	type Icon,
} from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"
import { flightProgress, useFlightStore, type Flight } from "@/store/flight"
import { useSimStore } from "@/store/sim"

import {
	crossedLine,
	distanceLine,
	travelTimes,
	type TravelMode,
} from "./flightFacts"

import classes from "./FlightReadout.module.css"

const ICONS: Readonly<Record<TravelMode, Icon>> = {
	light: IconBulb,
	probe: IconRocket,
	car: IconCar,
}

const FlightCard = ({
	flight,
	className,
}: {
	flight: Flight
	className: string
}) => {
	const i18n = useI18n()
	const { t } = i18n
	const name = useBodyName()
	const finishMove = useSimStore((state) => state.finishMove)
	const dismiss = useFlightStore((state) => state.dismiss)
	const bar = useRef<HTMLDivElement>(null)
	const counter = useRef<HTMLSpanElement>(null)
	const times = useMemo(
		() => travelTimes(flight.distanceKm, i18n),
		[flight.distanceKm, i18n],
	)

	// the kilometres crossed, following the camera's own easing
	useEffect(() => {
		let frame = 0
		let shown = ""
		const draw = () => {
			const share = flightProgress(flight, performance.now())
			if (bar.current !== null) {
				bar.current.style.transform = `scaleX(${share})`
			}
			const text = crossedLine(flight.distanceKm * share, i18n)
			if (counter.current !== null && text !== shown) {
				counter.current.textContent = text
				shown = text
			}
			if (share < 1) frame = requestAnimationFrame(draw)
		}
		draw()
		return () => cancelAnimationFrame(frame)
	}, [flight, i18n])

	return (
		<section
			className={`${className} ${classes.root}`}
			aria-label={t("solarSystem.flight.label")}
			data-testid="flight-readout"
			data-arrived={flight.arrived}
		>
			<header className={classes.header}>
				<p className={classes.headline} role="status">
					<span className={classes.route}>
						{t("solarSystem.flight.route", {
							from: name(flight.fromId),
							to: name(flight.toId),
						})}
					</span>
					<span className={classes.distance}>
						{distanceLine(flight.distanceKm, i18n)}
					</span>
				</p>
				{flight.arrived ? (
					<CloseButton
						size="sm"
						onClick={dismiss}
						aria-label={t("solarSystem.flight.close")}
					/>
				) : (
					<Button
						className={classes.skip}
						size="compact-sm"
						variant="light"
						color="orange"
						rightSection={<IconPlayerTrackNext size={14} aria-hidden />}
						onClick={finishMove}
					>
						{t("solarSystem.flight.skip")}
					</Button>
				)}
			</header>
			<div className={classes.progress} aria-hidden>
				<div className={classes.track}>
					<div ref={bar} className={classes.bar} />
				</div>
				<span ref={counter} className={classes.counter} />
			</div>
			<p className={classes.question}>{t("solarSystem.flight.question")}</p>
			<ul className={classes.times}>
				{times.map(({ mode, label, time }) => {
					const ModeIcon = ICONS[mode]
					return (
						<li key={mode} className={classes.time} data-mode={mode}>
							<ModeIcon className={classes.icon} size={16} aria-hidden />
							<span className={classes.label}>{label}</span>
							<strong className={classes.value}>{time}</strong>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

/**
 * The readout while a flight runs or has brought the camera to its
 * destination; nothing once the view is anywhere else. `className` is the
 * HUD's panel style.
 */
const FlightReadout = ({ className = "" }: { className?: string }) => {
	const flight = useFlightStore((state) => state.flight)
	const here = useSimStore(
		(state) =>
			flight !== null &&
			state.view.kind === "body" &&
			state.view.id === flight.toId,
	)
	if (flight === null || !here) return null
	return <FlightCard key={flight.id} flight={flight} className={className} />
}

export default FlightReadout
