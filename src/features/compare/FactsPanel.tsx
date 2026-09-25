/**
 * What a class can discuss about the pair (#24): the plain-language
 * comparisons of `pairFacts` (size, volume, mass, weight, year, day, the
 * strange calendars, the distance at the moment on screen), each with the
 * exact numbers under it, then the authored human-scale pictures of both
 * bodies from the editorial content (#11).
 */
import { useMemo } from "react"

import { getBody } from "@/data"
import { useI18n } from "@/i18n"
import { useBodyText } from "@/i18n/bodies"

import { pairFacts } from "./compareFacts"
import type { ComparePreset } from "./selection"

import classes from "./Compare.module.css"

export interface FactsPanelProps {
	/** The pair: the first body and the one it is compared with. */
	a: string
	b: string
	/** More bodies are drawn than the pair (then a click picks another). */
	more: boolean
	jd: number
	live: boolean
	/** The idea on screen (#40): named with its teaser, its point first. */
	idea?: ComparePreset
}

const FactsPanel = ({ a, b, more, jd, live, idea }: FactsPanelProps) => {
	const i18n = useI18n()
	const { t } = i18n
	const textA = useBodyText(a)
	const textB = useBodyText(b)
	const facts = useMemo(
		() =>
			pairFacts(getBody(a), getBody(b), i18n, { jd, live, lead: idea?.lead }),
		[a, b, i18n, jd, live, idea],
	)
	const stories = [textA, textB]
		.map((text) => ({ id: text.id, story: text.comparisons[0] }))
		.filter(
			(entry): entry is { id: string; story: string } =>
				entry.story !== undefined,
		)

	return (
		<section className={classes.facts} data-testid="compare-facts">
			{idea !== undefined && (
				<p className={classes.idea} data-testid="compare-idea">
					<span className={classes.ideaTitle}>
						{t(`compare.presets.${idea.id}`)}
					</span>{" "}
					{t(`compare.teasers.${idea.id}`)}
				</p>
			)}
			<header className={classes.factsHeader}>
				<h2 className={classes.factsTitle}>
					{t("compare.facts.heading", { a: textA.name, b: textB.name })}
				</h2>
				{more && <p className={classes.hint}>{t("compare.stage.pickHint")}</p>}
			</header>
			<div className={classes.factGrid}>
				{facts.map((fact) => (
					<article key={fact.id} className={classes.fact} data-fact={fact.key}>
						<h3 className={classes.factLabel}>{fact.label}</h3>
						<p className={classes.factText}>{fact.comparison}</p>
						{fact.values.length > 0 && (
							<p className={classes.factValues}>
								{fact.values.map((value, i) => (
									<span key={i} className={classes.factValue}>
										{value.name !== null && (
											<span className={classes.factValueName}>
												{value.name}
											</span>
										)}
										{value.text}
									</span>
								))}
							</p>
						)}
						{fact.notes.map((note) => (
							<p key={note} className={classes.factNote}>
								{note}
							</p>
						))}
					</article>
				))}
			</div>
			{stories.length > 0 && (
				<section className={classes.stories}>
					<h3 className={classes.factLabel}>{t("compare.facts.pictureIt")}</h3>
					{stories.map((entry) => (
						<p key={entry.id} className={classes.story}>
							{entry.story}
						</p>
					))}
				</section>
			)}
		</section>
	)
}

export default FactsPanel
