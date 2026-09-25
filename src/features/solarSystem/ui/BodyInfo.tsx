/**
 * The focused view's card (#16): the selected body (else the body the view is
 * on), its name and tagline, an authored comparison, the headline facts
 * (comparative first: "11 Earths wide", with the exact number beside it), a
 * link into its dictionary entry, and a way back to the overview. With
 * nothing to show (the overview, a free view) it tells a first-time visitor
 * that the planets can be clicked. On phones the facts fold away behind a
 * toggle so the card never buries the scene.
 */
import { useMemo, useState } from "react"
import { ActionIcon, Anchor, Button, CloseButton } from "@mantine/core"
import { useMediaQuery } from "@mantine/hooks"
import {
	IconChevronDown,
	IconChevronUp,
	IconHandClick,
	IconScale,
} from "@tabler/icons-react"
import { Link, useNavigate } from "@tanstack/react-router"

import { compareSearchFor } from "@/features/compare/links"

import { bodyById } from "@/data"
import { useI18n } from "@/i18n"
import { useBodyText } from "@/i18n/bodies"
import { useSimStore, type SimState } from "@/store/sim"

import BodyRecording from "../sound/BodyRecording"
import { headlineFacts } from "./bodyFacts"
import { dictionaryEntry } from "./dictionaryEntry"
import MoonSystem from "./MoonSystem"

import classes from "./BodyInfo.module.css"

/** The body the card is about: the selection, else the focused body; null in the overview or a free view. */
export const cardBodyId = (
	state: Pick<SimState, "selectedId" | "view">,
): string | null =>
	state.selectedId ?? (state.view.kind === "body" ? state.view.id : null)

/** Matches the phone layout of SolarSystem.module.css. */
const PHONE_QUERY = "(max-width: 599px)"

/**
 * "Compare with…" (#24): the body beside its first partner at true relative
 * size, measured at the moment on screen. In the card's header, so it is one
 * click away however long the facts are and while a phone folds them away.
 */
const CompareButton = ({ bodyId }: { bodyId: string }) => {
	const { t } = useI18n()
	const navigate = useNavigate()
	return (
		<Button
			variant="light"
			color="orange"
			size="compact-sm"
			leftSection={<IconScale size={16} />}
			onClick={() =>
				void navigate({
					to: "/compare",
					search: compareSearchFor(bodyId, useSimStore.getState()),
				})
			}
		>
			{t("solarSystem.card.compare")}
		</Button>
	)
}

const ClickHint = () => {
	const { t } = useI18n()
	return (
		<p className={classes.hint} data-testid="click-hint">
			<IconHandClick size={18} aria-hidden="true" />
			{t("solarSystem.pick.hint")}
		</p>
	)
}

const BodyCard = ({ bodyId }: { bodyId: string }) => {
	const i18n = useI18n()
	const { t } = i18n
	const text = useBodyText(bodyId)
	const body = bodyById.get(bodyId)
	const facts = useMemo(
		() => (body === undefined ? [] : headlineFacts(body, i18n)),
		[body, i18n],
	)
	const reset = useSimStore((state) => state.reset)
	const phone = useMediaQuery(PHONE_QUERY) ?? false
	const [expanded, setExpanded] = useState<boolean | null>(null)
	const open = expanded ?? !phone
	if (body === undefined) return null
	const entry = dictionaryEntry(body.id)
	const story = text.comparisons[0]
	const close = t("solarSystem.card.close")
	const toggle = t(
		open ? "solarSystem.card.hideFacts" : "solarSystem.card.showFacts",
	)

	return (
		<section
			className={classes.root}
			aria-label={t("solarSystem.info.label")}
			data-testid="body-card"
			data-card-body={body.id}
		>
			<header className={classes.header}>
				<div className={classes.title}>
					<h2 className={classes.name}>{text.name}</h2>
					<p className={classes.tagline}>{text.tagline}</p>
				</div>
				<CompareButton bodyId={body.id} />
				<ActionIcon
					className={classes.toggle}
					variant="subtle"
					color="gray"
					size="lg"
					aria-label={toggle}
					aria-expanded={open}
					title={toggle}
					onClick={() => setExpanded(!open)}
				>
					{open ? <IconChevronDown size={18} /> : <IconChevronUp size={18} />}
				</ActionIcon>
				<CloseButton
					size="lg"
					aria-label={close}
					aria-keyshortcuts="Escape"
					title={close}
					onClick={reset}
				/>
			</header>
			{open && (
				<>
					{story !== undefined && <p className={classes.story}>{story}</p>}
					<BodyRecording bodyId={body.id} />
					<MoonSystem body={body} />
					<dl className={classes.facts}>
						{facts.map((fact) => (
							<div key={fact.key} className={classes.fact} data-fact={fact.key}>
								<dt className={classes.label}>{fact.label}</dt>
								<dd className={classes.comparison}>
									{fact.comparison}
									{fact.value !== null && (
										<span className={classes.value}>{fact.value}</span>
									)}
								</dd>
							</div>
						))}
					</dl>
					{entry !== null && (
						<Anchor
							className={classes.more}
							size="sm"
							renderRoot={(props) => (
								<Link
									{...props}
									to="/solar_dictionary"
									search={{ entity: entry === 0 ? undefined : entry }}
								/>
							)}
						>
							{t("solarSystem.card.dictionary")} →
						</Anchor>
					)}
				</>
			)}
		</section>
	)
}

/** The card of the selected or focused body, else the click hint. */
const BodyInfo = () => {
	const bodyId = useSimStore(cardBodyId)
	return bodyId === null ? (
		<ClickHint />
	) : (
		<BodyCard key={bodyId} bodyId={bodyId} />
	)
}

export default BodyInfo
