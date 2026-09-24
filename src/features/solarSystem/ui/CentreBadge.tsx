import { Button } from "@mantine/core"
import { IconFocusCentered } from "@tabler/icons-react"

import { useSimStore } from "@/store/sim"

import {
	CENTRE_TEXT,
	freeCentre,
	freeCentreId,
	freeCentrePlace,
} from "./centre"

import classes from "./CentreBadge.module.css"

/**
 * Says what the view is centred on while it is a point in space (#15), and
 * offers the obvious way back: centre on the body whose neighbourhood it is,
 * or back to the overview out between the planets. Renders nothing while a
 * body or the overview is at the centre (the picker names it then).
 */
const CentreBadge = () => {
	const centre = freeCentre(useSimStore(freeCentreId))
	const setFocus = useSimStore((state) => state.setFocus)
	const overview = useSimStore((state) => state.overview)
	if (centre === null) return null
	const { anchor, interplanetary } = centre

	return (
		<section
			className={classes.root}
			aria-label={CENTRE_TEXT.region}
			role="status"
			data-testid="centre-badge"
		>
			<IconFocusCentered className={classes.icon} size={20} aria-hidden />
			<span className={classes.text}>
				<span className={classes.title}>{CENTRE_TEXT.freeView}</span>
				<span className={classes.place}>{freeCentrePlace(centre)}</span>
			</span>
			<Button
				className={classes.action}
				size="compact-sm"
				variant="light"
				color="orange"
				onClick={() => (interplanetary ? overview() : setFocus(anchor.id))}
			>
				{interplanetary
					? CENTRE_TEXT.backToOverview
					: CENTRE_TEXT.centreOn(anchor.name)}
			</Button>
		</section>
	)
}

export default CentreBadge
