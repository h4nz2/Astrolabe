/** The body card's recording (#32), for the bodies that have one; nothing otherwise. */
import { useI18n } from "@/i18n"

import { recordingForBody } from "./recordings"
import RecordingButton from "./RecordingButton"

import classes from "./Sound.module.css"

function BodyRecording({ bodyId }: { bodyId: string }) {
	const { t } = useI18n()
	const recording = recordingForBody(bodyId)
	if (recording === undefined) return null
	return (
		<section
			className={classes.cardRecording}
			aria-label={t("solarSystem.sound.recordings")}
			data-testid="body-recording"
		>
			<RecordingButton recording={recording} />
		</section>
	)
}

export default BodyRecording
