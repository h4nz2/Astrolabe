/**
 * One recording (#32): a Listen / Stop button, the honest one-line
 * explanation of what it is, and the credit its licence asks for. The words
 * are always on screen, so nothing depends on hearing it.
 */
import { Anchor, Button } from "@mantine/core"
import { IconHeadphones, IconPlayerStop } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { useSoundStore } from "@/store/sound"

import { playRecording } from "./player"
import { RECORDING_CREDIT, type Recording } from "./recordings"

import classes from "./Sound.module.css"

export type RecordingButtonProps = {
	recording: Recording
	/** Show the explanation under the button (the card); the settings list keeps it short. */
	explain?: boolean
}

function RecordingButton({ recording, explain = true }: RecordingButtonProps) {
	const { t } = useI18n()
	const playing = useSoundStore((state) => state.playing === recording.id)
	const setPlaying = useSoundStore((state) => state.setPlaying)
	const key = `solarSystem.sound.recording.${recording.id}` as const
	const title = t(`${key}.title`)

	return (
		<div className={classes.recording} data-recording={recording.id}>
			<Button
				size="compact-sm"
				variant={playing ? "filled" : "light"}
				color="orange"
				leftSection={
					playing ? (
						<IconPlayerStop size={14} aria-hidden />
					) : (
						<IconHeadphones size={14} aria-hidden />
					)
				}
				aria-pressed={playing}
				aria-label={t(
					playing
						? "solarSystem.sound.stopLabel"
						: "solarSystem.sound.listenLabel",
					{ title },
				)}
				onClick={() =>
					playing ? setPlaying(null) : playRecording(recording.id)
				}
			>
				{title}
			</Button>
			{explain && <p className={classes.what}>{t(`${key}.what`)}</p>}
			<p className={classes.credit}>
				{t("solarSystem.sound.credit", {
					mission: recording.mission,
					year: String(recording.year),
					credit: RECORDING_CREDIT,
				})}{" "}
				·{" "}
				<Anchor
					href={recording.sourceUrl}
					target="_blank"
					rel="noopener noreferrer"
					size="xs"
				>
					{recording.licence}
				</Anchor>
			</p>
		</div>
	)
}

export default RecordingButton
