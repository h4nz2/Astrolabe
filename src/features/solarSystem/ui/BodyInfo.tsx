import { bodyById, type Body } from "@/data"
import { kmToAu } from "@/sim"
import { useSimStore } from "@/store/sim"

import { formatAu, formatNumber } from "./format"

import classes from "./BodyInfo.module.css"

const parentOf = (body: Body): Body | undefined =>
	body.parentId === null ? undefined : bodyById.get(body.parentId)

const kindLabel = (body: Body): string => {
	if (body.kind === "star") return "Star"
	if (body.kind === "planet") return "Planet"
	const parent = parentOf(body)
	return parent === undefined ? "Moon" : `Moon of ${parent.name}`
}

const rotationLabel = (periodHours: number | null): string => {
	if (periodHours === null) return "unknown"
	const hours = `${formatNumber(Math.abs(periodHours))} h`
	return periodHours < 0 ? `${hours}, retrograde` : hours
}

/** Compact facts about the selected body, else the focus (the page layout hides it on phones). */
const BodyInfo = () => {
	const bodyId = useSimStore((state) => state.selectedId ?? state.focusId)
	const body = bodyById.get(bodyId)
	if (body === undefined) return null
	const { orbit, rotation } = body
	const parent = parentOf(body)

	return (
		<section className={classes.root} aria-label="Focused body">
			<header className={classes.title}>
				<span className={classes.name}>{body.name}</span>
				<span className={classes.kind}>{kindLabel(body)}</span>
			</header>
			<dl className={classes.facts}>
				<dt className={classes.label}>Radius</dt>
				<dd className={classes.value}>
					{body.radiusEstimated ? "≈ " : ""}
					{formatNumber(body.radiusKm)} km
				</dd>
				{orbit !== null && (
					<>
						<dt className={classes.label}>Orbital period</dt>
						<dd className={classes.value}>
							{formatNumber(orbit.periodDays)} days
						</dd>
						<dt className={classes.label}>
							Distance to {parent?.name ?? "parent"}
						</dt>
						<dd className={classes.value}>
							{formatNumber(orbit.semiMajorAxisKm)} km
							<span className={classes.secondary}>
								{formatAu(kmToAu(orbit.semiMajorAxisKm))} AU
							</span>
						</dd>
					</>
				)}
				<dt className={classes.label}>Rotation period</dt>
				<dd className={classes.value}>{rotationLabel(rotation.periodHours)}</dd>
			</dl>
		</section>
	)
}

export default BodyInfo
