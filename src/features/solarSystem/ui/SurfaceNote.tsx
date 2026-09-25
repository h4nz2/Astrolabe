/**
 * Where a moon's surface comes from (#37), one line on its card: a real map and its source
 * ("Surface map: Voyager 2 · NASA/JPL/USGS"), that part of the moon was never photographed
 * (the map is filled in there), that no spacecraft has mapped it (the surface is painted from
 * what is known), or that what we see is haze (Titan). Being truthful about which is which is
 * the point: a painted moon must not pass for a photographed one.
 */
import { creditById, type Body } from "@/data"
import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"

import classes from "./MoonSystem.module.css"

const SurfaceNote = ({ moon }: { moon: Body }) => {
	const { t } = useI18n()
	const name = useBodyName()
	const { surface } = moon
	if (surface === undefined) return null
	const moonName = name(moon.id)
	let text: string
	if (surface.kind === "map") {
		const source = creditById.get(surface.source)?.short ?? surface.source
		text = t("solarSystem.surface.map", { source })
		if (surface.filled) {
			text += ` ${t("solarSystem.surface.unseen", { moon: moonName })}`
		}
	} else if (surface.kind === "haze") {
		text = t("solarSystem.surface.haze", { moon: moonName })
	} else {
		text = t("solarSystem.surface.painted", { moon: moonName })
	}
	return (
		<p
			className={classes.surface}
			data-testid="surface-note"
			data-surface={surface.kind}
			data-filled={surface.filled ? "true" : undefined}
		>
			{text}
		</p>
	)
}

export default SurfaceNote
