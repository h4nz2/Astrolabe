/**
 * What the opening shows over the scene (#30): the caption of the beat on
 * screen, a Skip button from the very first frame, and a row of segments that
 * fill beat by beat. Not a modal: nothing but the card itself catches the
 * pointer, the scene and every HUD control stay usable, and any interaction
 * ends the opening. After the opening, the same slot shows the fading hints.
 */
import { useEffect } from "react"
import { Button } from "@mantine/core"
import { IconPlayerTrackNext } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"

import { introCaption } from "./captions"
import { skipIntro, useIntroStore } from "./intro"
import IntroHints from "./IntroHints"
import { INTRO_BEATS } from "./script"

import classes from "./Intro.module.css"

/** Mirrors the status on `<html data-intro>`, so the HUD can step back while the opening plays. */
const useDocumentStatus = (status: string) => {
	useEffect(() => {
		const root = document.documentElement
		root.dataset.intro = status
		return () => {
			delete root.dataset.intro
		}
	}, [status])
}

const Opening = () => {
	const i18n = useI18n()
	const name = useBodyName()
	const beat = useIntroStore((state) => state.beat)
	const steps = useIntroStore((state) => state.steps)
	const reducedMotion = useIntroStore((state) => state.reducedMotion)
	const id = INTRO_BEATS[beat] ?? INTRO_BEATS[0]
	const caption = introCaption(id, i18n, name)
	const { t } = i18n

	return (
		<section
			className={classes.card}
			aria-label={t("solarSystem.intro.label")}
			data-testid="intro"
			data-beat={id}
		>
			<div className={classes.caption} aria-live="polite" key={id}>
				<p className={classes.title}>{caption.title}</p>
				<p className={classes.detail}>{caption.detail}</p>
			</div>
			<div className={classes.footer}>
				<div
					className={classes.segments}
					role="progressbar"
					aria-valuemin={1}
					aria-valuemax={INTRO_BEATS.length}
					aria-valuenow={beat + 1}
					aria-valuetext={t("solarSystem.intro.progress", {
						beat: beat + 1,
						count: INTRO_BEATS.length,
					})}
				>
					{INTRO_BEATS.map((segment, index) => {
						const step = steps?.[index]
						const ms = (step?.durationMs ?? 0) + (step?.holdMs ?? 0)
						return (
							<span
								key={segment}
								className={classes.segment}
								data-state={
									index < beat ? "done" : index === beat ? "now" : "next"
								}
								style={
									index === beat && !reducedMotion
										? { animationDuration: `${ms}ms` }
										: undefined
								}
							/>
						)
					})}
				</div>
				<Button
					className={classes.skip}
					variant="white"
					color="dark"
					size="compact-md"
					rightSection={<IconPlayerTrackNext size={16} aria-hidden />}
					aria-keyshortcuts="Escape"
					onClick={skipIntro}
					data-testid="intro-skip"
				>
					{t("solarSystem.intro.skip")}
				</Button>
			</div>
		</section>
	)
}

/** The opening's slot in the HUD: the captions while it plays, the hints after it. */
const IntroOverlay = ({ className }: { className?: string }) => {
	const status = useIntroStore((state) => state.status)
	useDocumentStatus(status)
	if (status === "off") return null
	return (
		<div className={`${classes.slot} ${className ?? ""}`}>
			{status === "playing" ? <Opening /> : <IntroHints />}
		</div>
	)
}

export default IntroOverlay
