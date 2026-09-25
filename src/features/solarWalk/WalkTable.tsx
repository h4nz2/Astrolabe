import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"

import { formatLength, roundCount } from "./lengths"
import {
	landmarkCount,
	type LandmarkId,
	type ModelBody,
	type SolarWalk,
} from "./walk"
import { ratioText } from "./walkText"

import classes from "./SolarWalk.module.css"

/** Model bodies up to this size get a circle printed at their model size (bigger ones would not fit a row). */
const MAX_PRINTED_CIRCLE_MM = 30

export type WalkTableProps = {
	walk: SolarWalk
	landmark: LandmarkId | null
}

/**
 * The walk as one table: to project in class, and the printed hand-out a class
 * takes outside (a tick column for each stop reached). Small bodies carry a
 * circle drawn at their model size, which is exact on paper (CSS millimetres).
 */
const WalkTable = ({ walk, landmark }: WalkTableProps) => {
	const i18n = useI18n()
	const { t, formatLocale, number } = i18n
	const name = useBodyName()
	const length = (metres: number) => formatLength(metres, formatLocale)
	const count = (metres: number) =>
		landmark === null
			? null
			: number(roundCount(landmarkCount(metres, landmark)))

	const sizeCell = (body: ModelBody) => {
		const mm = body.sizeM * 1000
		return (
			<td className={classes.sizeCell}>
				{mm <= MAX_PRINTED_CIRCLE_MM && (
					<span
						className={classes.modelCircle}
						style={{ width: `${mm}mm`, height: `${mm}mm` }}
						aria-hidden
					/>
				)}
				{length(body.sizeM)}
			</td>
		)
	}
	const tick = (
		<td className={classes.tick}>
			<span className={classes.box} aria-hidden />
		</td>
	)

	return (
		<table className={classes.table}>
			<caption className={classes.caption}>
				{t("solarWalk.tableCaption", {
					object: t(`solarWalk.sunObject.${walk.sunObject}`),
					ratio: ratioText(walk, i18n),
				})}
			</caption>
			<thead>
				<tr>
					<th scope="col">{t("solarWalk.column.stop")}</th>
					<th scope="col">{t("solarWalk.column.body")}</th>
					<th scope="col">{t("solarWalk.column.size")}</th>
					<th scope="col">{t("solarWalk.column.thing")}</th>
					<th scope="col">{t("solarWalk.column.distance")}</th>
					<th scope="col">{t("solarWalk.column.leg")}</th>
					{landmark !== null && (
						<th scope="col">{t(`solarWalk.landmarkColumn.${landmark}`)}</th>
					)}
					<th scope="col">{t("solarWalk.column.done")}</th>
				</tr>
			</thead>
			<tbody>
				<tr data-row="sun">
					<td>{t("solarWalk.start")}</td>
					<th scope="row">{name("sun")}</th>
					<td>{length(walk.sun.sizeM)}</td>
					<td>{t(`solarWalk.sunObject.${walk.sunObject}`)}</td>
					<td>{length(0)}</td>
					<td />
					{landmark !== null && <td />}
					{tick}
				</tr>
				{walk.stops.map((stop, index) => [
					<tr key={stop.id} data-row={stop.id}>
						<td>{index + 1}</td>
						<th scope="row">{name(stop.id)}</th>
						{sizeCell(stop)}
						<td>{t(`solarWalk.thing.${stop.thing}`)}</td>
						<td className={classes.num}>{length(stop.distanceM)}</td>
						<td className={classes.num}>{length(stop.legM)}</td>
						{landmark !== null && (
							<td className={classes.num}>{count(stop.distanceM)}</td>
						)}
						{tick}
					</tr>,
					...stop.moons.map((moon) => (
						<tr key={moon.id} data-row={moon.id} className={classes.moonRow}>
							<td />
							<th scope="row">{name(moon.id)}</th>
							{sizeCell(moon)}
							<td>{t(`solarWalk.thing.${moon.thing}`)}</td>
							<td colSpan={2}>
								{t("solarWalk.moonDistance", {
									distance: length(moon.distanceM),
								})}
							</td>
							{landmark !== null && <td />}
							<td />
						</tr>
					)),
				])}
				<tr data-row="nearestStar" className={classes.starRow}>
					<td />
					<th scope="row">{t("solarWalk.starName")}</th>
					{sizeCell(walk.nearestStar)}
					<td>{t(`solarWalk.thing.${walk.nearestStar.thing}`)}</td>
					<td className={classes.num}>{length(walk.nearestStar.distanceM)}</td>
					<td />
					{landmark !== null && <td />}
					<td />
				</tr>
			</tbody>
		</table>
	)
}

export default WalkTable
