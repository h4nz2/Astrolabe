/**
 * Where the picture of the Sun or a planet comes from, one quiet line at the foot of its card
 * (data/planet-textures.json; a moon's card has its own, SurfaceNote): a real map and its
 * source, the Sun in ultraviolet light, bands painted after spacecraft photos (no openly
 * licensed global map exists), or clouds hiding the ground (Venus). As for the moons (#37), a
 * painted planet must not pass for a photographed one.
 */
import { creditById, type Body } from "@/data"
import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"

import classes from "./MoonSystem.module.css"

const WorldSurfaceNote = ({ body }: { body: Body }) => {
	const { t } = useI18n()
	const name = useBodyName()
	const { surface } = body
	if (surface === undefined || body.kind === "moon") return null
	const source = creditById.get(surface.source)?.short ?? surface.source
	const text =
		surface.kind === "haze"
			? t("solarSystem.surface.clouds", { body: name(body.id) })
			: surface.kind === "painted"
				? t("solarSystem.surface.bands", { body: name(body.id) })
				: body.kind === "star"
					? t("solarSystem.surface.sun", { source })
					: t("solarSystem.surface.map", { source })
	return (
		<p
			className={classes.surface}
			data-testid="world-surface-note"
			data-surface={surface.kind}
		>
			{text}
		</p>
	)
}

export default WorldSurfaceNote
