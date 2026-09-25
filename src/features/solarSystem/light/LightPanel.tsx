/**
 * The light panel (#27), docked in the HUD. Closed, it is one button (showing
 * the running clock while a pulse is out). Open, it has three tabs:
 *
 *  - Flash: send a light pulse from a body; the time it has been travelling
 *    (true travel time, whatever the speed), and the bodies it reaches, each
 *    announced as it happens.
 *  - Signal delay: how long a message from Earth takes to any body right now,
 *    and its range over the orbits, with what that means for a rover.
 *  - Farther out: light from the nearest star, the galactic centre, Andromeda.
 *
 * Every body is picked from a list or by selecting it in the scene; nothing
 * asks for a number.
 */
import { useEffect, useMemo } from "react"
import {
	Button,
	CloseButton,
	Group,
	ScrollArea,
	SegmentedControl,
	Select,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import { IconBolt, IconCheck } from "@tabler/icons-react"

import { useI18n, type I18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"
import { kmToAu } from "@/sim"
import {
	SPEED_OF_LIGHT_KM_S,
	frontRadiusKm,
	lightDistanceKm,
	secondsSince,
} from "@/sim/light"
import {
	HOME_ID,
	useLightStore,
	type LightPulse,
	type LightTab,
} from "@/store/light"
import { useSimStore } from "@/store/sim"

import useThrottledSimTime from "../scene/useThrottledSimTime"
import { warpLabel } from "../ui/warp"
import {
	BEYOND,
	LIGHT_BODY_IDS,
	NEAREST_STAR_YEARS,
	PLANETS_EDGE_KM,
	formatDuration,
	pulseArrivals,
	roughSeconds,
	signalDelay,
} from "./lightTravel"

import classes from "./LightPanel.module.css"

const YEAR_SECONDS = 365.25 * 86400

/** "384,400 km", "150 million km" / "150 Millionen km". */
export function formatDistanceKm(km: number, i18n: I18n): string {
	const value =
		km < 1e6
			? i18n.number(Math.round(km))
			: new Intl.NumberFormat(i18n.formatLocale, {
					notation: "compact",
					compactDisplay: "long",
					maximumSignificantDigits: 3,
				}).format(km)
	return i18n.t("solarSystem.light.km", { value })
}

/** A body picker over the light bodies (plus `extra`, the selection, when it is another body). */
const BodySelect = ({
	label,
	value,
	onChange,
	exclude,
	extra,
	testId,
}: {
	label: string
	value: string
	onChange: (id: string) => void
	exclude?: string
	extra?: string | null
	testId: string
}) => {
	const name = useBodyName()
	const ids = [...LIGHT_BODY_IDS]
	if (extra != null && !ids.includes(extra)) ids.push(extra)
	if (!ids.includes(value)) ids.push(value)
	return (
		<Select
			size="xs"
			label={label}
			value={value}
			allowDeselect={false}
			checkIconPosition="right"
			comboboxProps={{ withinPortal: true, zIndex: 400 }}
			data-testid={testId}
			data={ids
				.filter((id) => id !== exclude)
				.map((id) => ({ value: id, label: name(id) }))}
			onChange={(id) => id !== null && onChange(id)}
		/>
	)
}

/** How the clock runs right now, relative to the lesson's real time. */
const ClockNote = () => {
	const i18n = useI18n()
	const { t } = i18n
	const warp = useSimStore((state) => state.timeWarp)
	const paused = useSimStore((state) => state.paused)
	const setTimeWarp = useSimStore((state) => state.setTimeWarp)
	const setPaused = useSimStore((state) => state.setPaused)
	if (!paused && warp === 1) {
		return (
			<Text size="xs" c="dimmed" data-light-clock="realTime">
				{t("solarSystem.light.clock.realTime")}
			</Text>
		)
	}
	const note = paused
		? t("solarSystem.light.clock.paused")
		: warp < 0
			? t("solarSystem.light.clock.reversed")
			: t("solarSystem.light.clock.fast", {
					speed: warpLabel(warp, i18n),
				})
	return (
		<Stack gap={4} className={classes.note} data-light-clock="changed">
			<Text size="xs" c="yellow.3" lh={1.35}>
				{note}
			</Text>
			<Button
				size="compact-xs"
				variant="light"
				color="orange"
				onClick={() => {
					setTimeWarp(1)
					setPaused(false)
				}}
			>
				{t("solarSystem.light.clock.backToRealTime")}
			</Button>
		</Stack>
	)
}

/** The running clock and the arrivals of the pulse that is out. */
const PulseStatus = ({ pulse }: { pulse: LightPulse }) => {
	const i18n = useI18n()
	const { t } = i18n
	const name = useBodyName()
	const jd = useThrottledSimTime()
	const arrivals = useMemo(() => pulseArrivals(pulse), [pulse])
	const seconds = secondsSince(pulse.emitJD, jd)
	const reached = arrivals.filter((arrival) => arrival.jd <= jd)
	const latest = reached.at(-1)

	if (seconds < 0) {
		return (
			<Text size="sm" c="yellow.3" data-light-status="waiting">
				{t("solarSystem.light.waiting")}
			</Text>
		)
	}
	return (
		<Stack gap="xs">
			<div className={classes.clock}>
				<Text size="xs" c="dimmed">
					{t("solarSystem.light.travelling")}
				</Text>
				<Text className={classes.elapsed} data-light-elapsed={seconds}>
					{formatDuration(seconds, i18n, true)}
				</Text>
				<Text size="xs" c="dimmed">
					{t("solarSystem.light.covered", {
						distance: formatDistanceKm(lightDistanceKm(seconds), i18n),
					})}
				</Text>
			</div>
			<ClockNote />
			<Text
				size="sm"
				fw={600}
				className={classes.announce}
				aria-live="polite"
				data-light-announce={latest?.id ?? ""}
			>
				{latest !== undefined
					? t("solarSystem.light.announce", {
							id: latest.id,
							body: name(latest.id),
							duration: formatDuration(latest.seconds, i18n),
						})
					: " "}
			</Text>
			{frontRadiusKm(pulse.emitJD, jd) > PLANETS_EDGE_KM &&
				reached.length === arrivals.length && (
					<Text size="xs" c="gray.4" lh={1.35}>
						{t("solarSystem.light.leftPlanets", {
							years: NEAREST_STAR_YEARS,
						})}
					</Text>
				)}
			<ol
				className={classes.arrivals}
				aria-label={t("solarSystem.light.arrivals")}
			>
				{arrivals.map((arrival) => {
					const done = arrival.jd <= jd
					return (
						<li
							key={arrival.id}
							className={classes.arrival}
							data-body={arrival.id}
							data-reached={done}
						>
							<span className={classes.arrivalName}>
								{done && (
									<IconCheck
										size={14}
										className={classes.check}
										aria-label={t("solarSystem.light.reached")}
									/>
								)}
								{name(arrival.id)}
							</span>
							<span className={classes.arrivalTime}>
								{formatDuration(arrival.seconds, i18n)}
							</span>
							<span className={classes.arrivalWait}>
								{done
									? ""
									: t("solarSystem.light.pending", {
											duration: formatDuration((arrival.jd - jd) * 86400, i18n),
										})}
							</span>
						</li>
					)
				})}
			</ol>
		</Stack>
	)
}

const PulseTab = () => {
	const { t } = useI18n()
	const pulse = useLightStore((state) => state.pulse)
	const emitterId = useLightStore((state) => state.emitterId)
	const setEmitter = useLightStore((state) => state.setEmitter)
	const send = useLightStore((state) => state.send)
	const clear = useLightStore((state) => state.clear)
	const selectedId = useSimStore((state) => state.selectedId)

	return (
		<Stack gap="sm">
			<Text size="xs" c="gray.4" lh={1.4}>
				{t("solarSystem.light.intro", { speed: SPEED_OF_LIGHT_KM_S })}
			</Text>
			<Group gap="xs" align="flex-end" wrap="wrap">
				<div className={classes.grow}>
					<BodySelect
						label={t("solarSystem.light.from")}
						value={emitterId}
						onChange={setEmitter}
						extra={selectedId}
						testId="light-emitter"
					/>
				</div>
				<Button
					size="xs"
					color="orange"
					leftSection={<IconBolt size={14} />}
					onClick={() => send()}
				>
					{pulse === null
						? t("solarSystem.light.send")
						: t("solarSystem.light.sendAgain")}
				</Button>
			</Group>
			{pulse !== null && (
				<>
					<PulseStatus pulse={pulse} />
					<Button
						size="compact-xs"
						variant="subtle"
						color="gray"
						onClick={clear}
					>
						{t("solarSystem.light.clear")}
					</Button>
				</>
			)}
		</Stack>
	)
}

const DelayTab = () => {
	const i18n = useI18n()
	const { t } = i18n
	const jd = useThrottledSimTime()
	const targetId = useLightStore((state) => state.delayTargetId)
	const setTarget = useLightStore((state) => state.setDelayTarget)
	const send = useLightStore((state) => state.send)
	const setTab = useLightStore((state) => state.setTab)
	const selectedId = useSimStore((state) => state.selectedId)

	// a body selected in the scene becomes the destination
	useEffect(() => {
		if (selectedId !== null && selectedId !== HOME_ID) setTarget(selectedId)
	}, [selectedId, setTarget])

	const delay = signalDelay(HOME_ID, targetId, jd)
	return (
		<Stack gap="sm">
			<Text size="xs" c="gray.4" lh={1.4}>
				{t("solarSystem.light.delay.intro")}
			</Text>
			<BodySelect
				label={t("solarSystem.light.delay.to")}
				value={targetId}
				onChange={setTarget}
				exclude={HOME_ID}
				extra={selectedId === HOME_ID ? null : selectedId}
				testId="light-delay-target"
			/>
			{delay !== null && (
				<>
					<dl className={classes.delay}>
						<dt>{t("solarSystem.light.delay.oneWay")}</dt>
						<dd data-light-delay={delay.seconds}>
							{formatDuration(delay.seconds, i18n)}
						</dd>
						<dt>{t("solarSystem.light.delay.roundTrip")}</dt>
						<dd>{formatDuration(delay.seconds * 2, i18n)}</dd>
					</dl>
					<Text size="xs" c="dimmed">
						{t("solarSystem.light.delay.now", {
							distance: formatDistanceKm(delay.distanceKm, i18n),
							au: i18n.significant(kmToAu(delay.distanceKm), 3),
						})}
					</Text>
					<Text size="xs" c="gray.4" lh={1.35}>
						{t("solarSystem.light.delay.range", {
							min: formatDuration(roughSeconds(delay.minSeconds), i18n),
							max: formatDuration(roughSeconds(delay.maxSeconds), i18n),
						})}
					</Text>
					{targetId !== "sun" && (
						<Text size="xs" c="gray.3" lh={1.4} className={classes.rover}>
							{t("solarSystem.light.delay.rover", {
								id: targetId,
								oneWay: formatDuration(delay.seconds, i18n),
								roundTrip: formatDuration(delay.seconds * 2, i18n),
							})}
						</Text>
					)}
					<Button
						size="xs"
						variant="light"
						color="orange"
						leftSection={<IconBolt size={14} />}
						onClick={() => {
							send(HOME_ID)
							setTab("pulse")
						}}
					>
						{t("solarSystem.light.delay.watch")}
					</Button>
				</>
			)}
		</Stack>
	)
}

const BeyondTab = () => {
	const i18n = useI18n()
	const { t } = i18n
	return (
		<Stack gap="sm">
			<Text size="xs" c="gray.4" lh={1.4}>
				{t("solarSystem.light.beyond.intro")}
			</Text>
			{BEYOND.map((place) => (
				<div key={place.id} className={classes.beyond} data-beyond={place.id}>
					<Group justify="space-between" wrap="nowrap" align="baseline">
						<Text size="sm" fw={600}>
							{t(`solarSystem.light.beyond.${place.id}.name`)}
						</Text>
						<Text size="sm" className={classes.beyondTime}>
							{formatDuration(place.lightYears * YEAR_SECONDS, i18n)}
						</Text>
					</Group>
					<Text size="xs" c="gray.4" lh={1.35}>
						{t(`solarSystem.light.beyond.${place.id}.text`, {
							duration: formatDuration(place.lightYears * YEAR_SECONDS, i18n),
						})}
					</Text>
				</div>
			))}
		</Stack>
	)
}

/** The closed state: one button, with the running clock while a pulse is out. */
const OpenButton = () => {
	const i18n = useI18n()
	const setOpen = useLightStore((state) => state.setOpen)
	const pulse = useLightStore((state) => state.pulse)
	const jd = useThrottledSimTime()
	const seconds = pulse === null ? null : secondsSince(pulse.emitJD, jd)
	return (
		<UnstyledButton
			className={classes.open}
			onClick={() => setOpen(true)}
			title={i18n.t("solarSystem.light.openHint")}
			aria-expanded={false}
		>
			<IconBolt size={16} className={classes.icon} />
			<span>{i18n.t("solarSystem.light.open")}</span>
			{seconds !== null && seconds >= 0 && (
				<span className={classes.openClock}>
					{formatDuration(seconds, i18n, true)}
				</span>
			)}
		</UnstyledButton>
	)
}

/** The light panel's HUD slot: the button, or the open panel. */
const LightPanel = () => {
	const { t } = useI18n()
	const open = useLightStore((state) => state.open)
	const setOpen = useLightStore((state) => state.setOpen)
	const tab = useLightStore((state) => state.tab)
	const setTab = useLightStore((state) => state.setTab)
	if (!open) return <OpenButton />
	return (
		<section
			className={classes.panel}
			aria-label={t("solarSystem.light.title")}
			data-light-panel
		>
			<Group justify="space-between" wrap="nowrap" mb={6}>
				<Group gap={6} wrap="nowrap">
					<IconBolt size={16} className={classes.icon} />
					<Text fw={700} size="sm">
						{t("solarSystem.light.title")}
					</Text>
				</Group>
				<CloseButton
					size="sm"
					aria-label={t("solarSystem.light.close")}
					onClick={() => setOpen(false)}
				/>
			</Group>
			<SegmentedControl<LightTab>
				fullWidth
				size="xs"
				radius="md"
				value={tab}
				onChange={setTab}
				mb="sm"
				data={[
					{ value: "pulse", label: t("solarSystem.light.tabs.pulse") },
					{ value: "delay", label: t("solarSystem.light.tabs.delay") },
					{ value: "beyond", label: t("solarSystem.light.tabs.beyond") },
				]}
			/>
			<ScrollArea.Autosize
				mah="var(--light-panel-body-max, 50dvh)"
				type="auto"
				scrollbars="y"
				offsetScrollbars="y"
			>
				{tab === "pulse" && <PulseTab />}
				{tab === "delay" && <DelayTab />}
				{tab === "beyond" && <BeyondTab />}
			</ScrollArea.Autosize>
		</section>
	)
}

/** The HUD's phone breakpoint (SolarSystem.module.css). */
const PHONE_QUERY = "(max-width: 599px)"

/**
 * Where the light panel is docked: under the focus picker on wider screens,
 * above the body card on phones, where the top of the screen is already full
 * of panels and the planets sit right below them. Renders only in the slot
 * for the current screen, wrapped in `className` (a HUD panel).
 */
export const LightSlot = ({
	phone,
	className,
}: {
	phone: boolean
	className: string
}) => {
	const isPhone = useMediaQuery(PHONE_QUERY, false, {
		getInitialValueInEffect: false,
	})
	if (isPhone !== phone) return null
	return (
		<div className={className}>
			<LightPanel />
		</div>
	)
}

export default LightPanel
