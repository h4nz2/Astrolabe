import { bodyById, type Body } from "@/data"
import { useI18n, type I18n } from "@/i18n"
import { bodyKindLabel, bodyName, useBodyText } from "@/i18n/bodies"
import { kmToAu } from "@/sim"
import { useSimStore } from "@/store/sim"

import classes from "./BodyInfo.module.css"

/** Periods from this long on read better in days (Venus: 243 days, not 5,832 hours). */
const ROTATION_DAYS_FROM_HOURS = 72

/** The rotation period, with its direction, and for a tidally locked moon a note saying so. */
const rotationFacts = (
	body: Pick<Body, "rotation" | "parentId">,
	i18n: I18n,
): { value: string; note: string | null } => {
	const { periodHours, synchronous } = body.rotation
	if (periodHours === null) {
		return { value: i18n.t("solarSystem.info.rotationUnknown"), note: null }
	}
	const hours = Math.abs(periodHours)
	const period =
		hours >= ROTATION_DAYS_FROM_HOURS
			? i18n.quantity(hours / 24, "day", "long")
			: i18n.quantity(hours, "hour", "long")
	const value =
		periodHours < 0 ? i18n.t("solarSystem.info.retrograde", { period }) : period
	const note =
		synchronous === true && body.parentId !== null
			? i18n.t("solarSystem.info.synchronous", {
					parentId: body.parentId,
					parent: bodyName(body.parentId, i18n.chain),
				})
			: null
	return { value, note }
}

/** Compact facts about the selected body, else the focus (the page layout hides it on phones). */
const BodyInfo = () => {
	const bodyId = useSimStore((state) => state.selectedId ?? state.focusId)
	const i18n = useI18n()
	const text = useBodyText(bodyId)
	const body = bodyById.get(bodyId)
	if (body === undefined) return null
	const { t } = i18n
	const { orbit } = body
	const kind = bodyKindLabel(body, i18n)
	const radius = i18n.quantity(body.radiusKm, "kilometer")
	const rotation = rotationFacts(body, i18n)

	return (
		<section className={classes.root} aria-label={t("solarSystem.info.label")}>
			<header className={classes.title}>
				<span className={classes.name}>{text.name}</span>
				<span className={classes.kind}>{kind}</span>
			</header>
			{text.tagline !== kind && (
				<p className={classes.tagline}>{text.tagline}</p>
			)}
			<dl className={classes.facts}>
				<dt className={classes.label}>{t("solarSystem.info.radius")}</dt>
				<dd className={classes.value}>
					{body.radiusEstimated ? t("units.approx", { value: radius }) : radius}
				</dd>
				{orbit !== null && body.parentId !== null && (
					<>
						<dt className={classes.label}>
							{t("solarSystem.info.orbitalPeriod")}
						</dt>
						<dd className={classes.value}>
							{i18n.quantity(orbit.periodDays, "day", "long")}
						</dd>
						<dt className={classes.label}>
							{t("solarSystem.info.distance", {
								parentId: body.parentId,
								parent: bodyName(body.parentId, i18n.chain),
							})}
						</dt>
						<dd className={classes.value}>
							{i18n.quantity(orbit.semiMajorAxisKm, "kilometer")}
							<span className={classes.secondary}>
								{t("units.au", {
									value: i18n.significant(kmToAu(orbit.semiMajorAxisKm)),
								})}
							</span>
						</dd>
					</>
				)}
				<dt className={classes.label}>{t("solarSystem.info.rotation")}</dt>
				<dd className={classes.value}>
					{rotation.value}
					{rotation.note !== null && (
						<span className={classes.secondary}>{rotation.note}</span>
					)}
				</dd>
			</dl>
		</section>
	)
}

export default BodyInfo
