import { useEffect, useMemo, useState } from "react"
import {
	ActionIcon,
	Badge,
	Button,
	Checkbox,
	CloseButton,
	CopyButton,
	Group,
	Popover,
	Stack,
	Text,
	TextInput,
	Title,
	Tooltip,
	UnstyledButton,
} from "@mantine/core"
import { useRouter } from "@tanstack/react-router"
import {
	IconArrowRight,
	IconBulb,
	IconCheck,
	IconChevronDown,
	IconChevronUp,
	IconConfetti,
	IconCopy,
	IconEye,
	IconMapSearch,
	IconRefresh,
	IconShare,
	IconSparkles,
} from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"
import { useHuntStore } from "@/store/hunt"
import { useSimStore } from "@/store/sim"

import {
	HUNTS,
	QUESTIONS,
	customHuntKey,
	resolveHunt,
	type HuntQuestion,
	type ResolvedHunt,
} from "./hunts"
import { huntTitle, questionText } from "./text"
import { showAnswer, watchAnswers } from "./watch"

import hudClasses from "../SolarSystem.module.css"
import classes from "./Hunt.module.css"

/** The link that opens `key` for everyone, in the teacher's language and reading level. */
function useShareUrl(key: string): string {
	const router = useRouter()
	return useMemo(() => {
		const location = router.buildLocation({
			to: "/solar_system",
			search: { hunt: key } as never,
		})
		return new URL(location.publicHref, window.location.origin).toString()
	}, [router, key])
}

const ShareButton = ({ huntKey }: { huntKey: string }) => {
	const { t } = useI18n()
	const url = useShareUrl(huntKey)
	return (
		<Popover width={320} position="bottom-end" withArrow shadow="md">
			<Popover.Target>
				<Button
					variant="subtle"
					color="gray"
					size="compact-sm"
					leftSection={<IconShare size={14} />}
				>
					{t("solarSystem.hunt.share.button")}
				</Button>
			</Popover.Target>
			<Popover.Dropdown>
				<Stack gap="xs">
					<Text fw={600} size="sm">
						{t("solarSystem.hunt.share.title")}
					</Text>
					<Text size="xs" c="dimmed">
						{t("solarSystem.hunt.share.text")}
					</Text>
					<TextInput
						readOnly
						value={url}
						aria-label={t("solarSystem.hunt.share.link")}
						onFocus={(event) => event.currentTarget.select()}
						data-testid="hunt-share-url"
					/>
					<CopyButton value={url}>
						{({ copied, copy }) => (
							<Button
								color={copied ? "teal" : "orange"}
								size="compact-sm"
								leftSection={
									copied ? <IconCheck size={14} /> : <IconCopy size={14} />
								}
								onClick={copy}
							>
								{copied
									? t("solarSystem.hunt.share.copied")
									: t("solarSystem.hunt.share.copy")}
							</Button>
						)}
					</CopyButton>
				</Stack>
			</Popover.Dropdown>
		</Popover>
	)
}

/** One dot per clue: found (filled), the current one (ringed), still to come. */
const ProgressDots = ({
	total,
	solved,
	current,
}: {
	total: number
	solved: number
	current: number
}) => {
	const { t } = useI18n()
	return (
		<div
			className={classes.dots}
			role="img"
			aria-label={t("solarSystem.hunt.progressLabel", { found: solved, total })}
		>
			{Array.from({ length: total }, (_, index) => (
				<span
					key={index}
					className={classes.dot}
					data-state={
						index < solved ? "found" : index === current ? "current" : "todo"
					}
				/>
			))}
		</div>
	)
}

/** A ready-made hunt, as a card in the chooser. */
const HuntCard = ({ hunt }: { hunt: (typeof HUNTS)[number] }) => {
	const i18n = useI18n()
	const { t } = i18n
	const { title, description } = huntTitle(hunt.id, i18n)
	const key = useHuntStore((state) => state.key)
	const step = useHuntStore((state) => state.step)
	const resume = useHuntStore((state) => state.resume)
	const start = useHuntStore((state) => state.start)
	const total = hunt.questions.length
	const inProgress = key === hunt.id && step > 0 && step < total
	return (
		<UnstyledButton
			className={classes.card}
			onClick={() => (inProgress ? resume(hunt.id) : start(hunt.id))}
			data-hunt={hunt.id}
		>
			<Group gap="xs" justify="space-between" wrap="nowrap">
				<Text fw={700}>{title}</Text>
				<Badge
					variant="light"
					color={
						hunt.difficulty === "easy"
							? "teal"
							: hunt.difficulty === "medium"
								? "orange"
								: "grape"
					}
				>
					{t(`solarSystem.hunt.difficulty.${hunt.difficulty}`)}
				</Badge>
			</Group>
			<Text size="sm" c="dimmed">
				{description}
			</Text>
			<Text size="xs" c="orange.4" fw={600}>
				{inProgress
					? t("solarSystem.hunt.inProgress", { step: step + 1, total })
					: t("solarSystem.hunt.clueCount", { count: total })}
			</Text>
		</UnstyledButton>
	)
}

/** A teacher's own hunt: tick clues from the whole bank, then start it (and share its link). */
const CustomHunt = () => {
	const i18n = useI18n()
	const { t } = i18n
	const start = useHuntStore((state) => state.start)
	const [picked, setPicked] = useState<string[]>([])
	return (
		<details className={classes.custom}>
			<summary className={classes.customSummary}>
				{t("solarSystem.hunt.custom.title")}
			</summary>
			<Stack gap="xs" mt="xs">
				<Text size="sm" c="dimmed">
					{t("solarSystem.hunt.custom.intro")}
				</Text>
				<Checkbox.Group value={picked} onChange={setPicked}>
					<Stack gap={6}>
						{QUESTIONS.map((question) => (
							<Checkbox
								key={question.id}
								value={question.id}
								color="orange"
								label={questionText(question.id, i18n).clue}
							/>
						))}
					</Stack>
				</Checkbox.Group>
				<Group justify="space-between">
					<Text size="sm">
						{t("solarSystem.hunt.custom.count", { count: picked.length })}
					</Text>
					<Button
						color="orange"
						size="compact-sm"
						disabled={picked.length === 0}
						onClick={() => start(customHuntKey(picked))}
					>
						{t("solarSystem.hunt.custom.start")}
					</Button>
				</Group>
			</Stack>
		</details>
	)
}

const Chooser = () => {
	const { t } = useI18n()
	return (
		<Stack gap="sm">
			<Text size="sm">{t("solarSystem.hunt.intro")}</Text>
			<Text fw={700} size="sm" tt="uppercase" c="dimmed">
				{t("solarSystem.hunt.choose")}
			</Text>
			<Stack gap="xs">
				{HUNTS.map((hunt) => (
					<HuntCard key={hunt.id} hunt={hunt} />
				))}
			</Stack>
			<CustomHunt />
		</Stack>
	)
}

/** The clue being asked: its words, escalating hints, kind words on a miss, "Show me" last. */
const Asking = ({ question }: { question: HuntQuestion }) => {
	const i18n = useI18n()
	const { t } = i18n
	const name = useBodyName()
	const words = questionText(question.id, i18n)
	const hints = useHuntStore((state) => state.hints)
	const guess = useHuntStore((state) => state.guess)
	const collapsed = useHuntStore((state) => state.collapsed)
	const hint = useHuntStore((state) => state.hint)

	useEffect(() => watchAnswers(question), [question])

	const shown = words.hints.slice(0, hints)
	const guessText =
		guess === null
			? null
			: guess.kind === "almost"
				? t("solarSystem.hunt.guess.almost", {
						name: name(guess.bodyId),
						frameId: question.frame ?? "",
						frame: name(question.frame ?? ""),
					})
				: t(`solarSystem.hunt.guess.${guess.kind}`, {
						bodyId: guess.bodyId,
						name: name(guess.bodyId),
					})

	return (
		<Stack gap="sm">
			<p className={classes.clue} data-testid="hunt-clue">
				{words.clue}
			</p>
			{!collapsed && (
				<>
					<Text size="sm" c="dimmed">
						{t("solarSystem.hunt.answerHow")}
					</Text>
					{shown.length > 0 && (
						<ol className={classes.hints}>
							{shown.map((text, index) => (
								<li key={index} className={classes.hintItem}>
									<IconBulb size={16} className={classes.hintIcon} />
									<span>
										<span className={classes.hintLabel}>
											{t("solarSystem.hunt.hintLabel", { n: index + 1 })}
										</span>{" "}
										{text}
									</span>
								</li>
							))}
						</ol>
					)}
					<Group gap="xs">
						{hints < words.hints.length ? (
							<Button
								variant="light"
								color="yellow"
								size="compact-sm"
								leftSection={<IconBulb size={14} />}
								onClick={() => hint(words.hints.length)}
							>
								{hints === 0
									? t("solarSystem.hunt.firstHint")
									: t("solarSystem.hunt.moreHint")}
							</Button>
						) : (
							<Tooltip label={t("solarSystem.hunt.showMeHint")} openDelay={400}>
								<Button
									variant="light"
									color="yellow"
									size="compact-sm"
									leftSection={<IconEye size={14} />}
									onClick={() => showAnswer(question)}
								>
									{t("solarSystem.hunt.showMe")}
								</Button>
							</Tooltip>
						)}
					</Group>
				</>
			)}
			<div aria-live="polite" className={classes.guess}>
				{guessText !== null && (
					<Text size="sm" c={guess?.kind === "other" ? "gray.4" : "yellow.3"}>
						{guessText}
					</Text>
				)}
			</div>
		</Stack>
	)
}

/** Just solved: what the class found and learned, then on to the next clue. */
const Found = ({
	question,
	last,
}: {
	question: HuntQuestion
	last: boolean
}) => {
	const i18n = useI18n()
	const { t } = i18n
	const next = useHuntStore((state) => state.next)
	const collapsed = useHuntStore((state) => state.collapsed)
	const words = questionText(question.id, i18n)
	return (
		<Stack gap="sm" aria-live="polite">
			<div className={classes.foundTitle}>
				<IconSparkles size={22} className={classes.sparkle} />
				<Text fw={800} size="lg" c="orange.4">
					{t("solarSystem.hunt.found")}
				</Text>
			</div>
			{!collapsed && <Text className={classes.foundText}>{words.found}</Text>}
			<Group>
				<Button
					color="orange"
					rightSection={<IconArrowRight size={16} />}
					onClick={next}
					data-autofocus
				>
					{last ? t("solarSystem.hunt.finish") : t("solarSystem.hunt.next")}
				</Button>
			</Group>
		</Stack>
	)
}

/** Every clue solved: a little celebration, the worlds found, and what to do next. */
const Done = ({ hunt }: { hunt: ResolvedHunt }) => {
	const { t } = useI18n()
	const name = useBodyName()
	const found = useHuntStore((state) => state.found)
	const start = useHuntStore((state) => state.start)
	const browse = useHuntStore((state) => state.browse)
	const setFocus = useSimStore((state) => state.setFocus)
	const worlds = [...new Set(found)]
	return (
		<Stack gap="sm" className={classes.done} data-testid="hunt-done">
			<div className={classes.celebrate} aria-hidden="true">
				<IconConfetti size={48} stroke={1.5} />
				<div className={classes.burst}>
					{Array.from({ length: 12 }, (_, index) => (
						<span
							key={index}
							className={classes.spark}
							style={{ "--angle": `${index * 30}deg` } as React.CSSProperties}
						/>
					))}
				</div>
			</div>
			<Title order={3} className={classes.doneTitle}>
				{t("solarSystem.hunt.done.title")}
			</Title>
			<Text>
				{t("solarSystem.hunt.done.text", { count: hunt.questions.length })}
			</Text>
			<Text size="sm" c="dimmed">
				{t("solarSystem.hunt.done.found")}
			</Text>
			<Group gap={6} justify="center">
				{worlds.map((id) => (
					<Button
						key={id}
						variant="light"
						color="gray"
						size="compact-sm"
						onClick={() => setFocus(id)}
					>
						{name(id)}
					</Button>
				))}
			</Group>
			<Group gap="xs" mt="xs" justify="center">
				<Button
					color="orange"
					leftSection={<IconRefresh size={16} />}
					onClick={() => start(hunt.key)}
				>
					{t("solarSystem.hunt.done.again")}
				</Button>
				<Button variant="light" color="orange" onClick={browse}>
					{t("solarSystem.hunt.done.other")}
				</Button>
			</Group>
		</Stack>
	)
}

const Play = ({ hunt }: { hunt: ResolvedHunt }) => {
	const step = useHuntStore((state) => state.step)
	const phase = useHuntStore((state) => state.phase)
	const total = hunt.questions.length
	if (step >= total) return <Done hunt={hunt} />
	const question = hunt.questions[step]
	return phase === "found" ? (
		<Found question={question} last={step === total - 1} />
	) : (
		<Asking question={question} />
	)
}

/**
 * The scavenger hunt (#34), docked at the right like the birthday panel so the
 * scene stays in view: the chooser, or the hunt being played with its
 * progress, the clue, hints and what was found. It folds up to the clue alone
 * for a phone or a crowded projector.
 */
const HuntPanel = () => {
	const i18n = useI18n()
	const { t } = i18n
	const key = useHuntStore((state) => (state.choosing ? null : state.key))
	const step = useHuntStore((state) => state.step)
	const phase = useHuntStore((state) => state.phase)
	const collapsed = useHuntStore((state) => state.collapsed)
	const setCollapsed = useHuntStore((state) => state.setCollapsed)
	const setOpen = useHuntStore((state) => state.setOpen)
	const browse = useHuntStore((state) => state.browse)
	const hunt = useMemo(() => resolveHunt(key), [key])

	const title =
		hunt === null
			? t("solarSystem.hunt.title")
			: hunt.id === null
				? t("solarSystem.hunt.custom.name")
				: huntTitle(hunt.id, i18n).title
	const total = hunt?.questions.length ?? 0
	const solved = Math.min(total, step + (phase === "found" ? 1 : 0))

	return (
		<section
			id="hunt-panel"
			className={`${hudClasses.panel} ${classes.panel}`}
			aria-labelledby="hunt-title"
			data-collapsed={collapsed || undefined}
		>
			<header className={classes.header}>
				<Group gap="xs" wrap="nowrap" justify="space-between">
					<Group gap={8} wrap="nowrap" miw={0}>
						<IconMapSearch size={20} className={classes.headerIcon} />
						<Title order={2} id="hunt-title" className={classes.title}>
							{title}
						</Title>
					</Group>
					<Group gap={2} wrap="nowrap">
						{hunt !== null && (
							<ActionIcon
								variant="subtle"
								color="gray"
								onClick={() => setCollapsed(!collapsed)}
								aria-label={
									collapsed
										? t("solarSystem.hunt.expand")
										: t("solarSystem.hunt.collapse")
								}
								aria-expanded={!collapsed}
							>
								{collapsed ? (
									<IconChevronDown size={18} />
								) : (
									<IconChevronUp size={18} />
								)}
							</ActionIcon>
						)}
						<CloseButton
							onClick={() => setOpen(false)}
							aria-label={t("solarSystem.hunt.close")}
						/>
					</Group>
				</Group>
				{hunt !== null && step < total && (
					<Group gap="xs" justify="space-between" wrap="nowrap" mt={4}>
						<Group gap="xs" wrap="nowrap">
							<Text size="sm" fw={600} data-testid="hunt-progress">
								{t("solarSystem.hunt.progress", {
									step: step + 1,
									total,
								})}
							</Text>
							<ProgressDots total={total} solved={solved} current={step} />
						</Group>
						{!collapsed && <ShareButton huntKey={hunt.key} />}
					</Group>
				)}
			</header>
			<div className={classes.body}>
				{hunt === null ? <Chooser /> : <Play hunt={hunt} />}
				{hunt !== null && !collapsed && step < total && (
					<Button
						variant="subtle"
						color="gray"
						size="compact-xs"
						mt="md"
						onClick={browse}
					>
						{t("solarSystem.hunt.otherHunts")}
					</Button>
				)}
			</div>
		</section>
	)
}

export default HuntPanel
