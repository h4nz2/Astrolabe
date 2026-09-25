/**
 * The sentences the HUD says about the small bodies (#23), built from `I18n` so they are
 * testable in every locale and reading level: what a belt's dots stand for and how empty
 * the belt really is, and what a comet is doing right now.
 */
import { belts, type Belt, type Body } from "@/data"
import type { I18n } from "@/i18n"
import { AU_KM, jdToDate, propagate, type Vec3 } from "@/sim"
import {
	TAIL_ONSET_KM,
	nextPerihelionJD,
	previousPerihelionJD,
	tailLengthKm,
} from "@/sim/comet"

import { LATEST_WATCH_JD } from "./cometWatch"
import { formatDayUTC } from "../ui/timeTravel"

/** Mean distance from the Earth to the Moon (km): the ruler for "how empty". */
export const EARTH_MOON_KM = 384400

/** Rounds to two significant digits: "about 380", "about 17", "2.6". */
const roughly = (value: number): number =>
	value > 0 && Number.isFinite(value) ? Number(value.toPrecision(2)) : 0

/** The belt a body counts as a member of (its semi-major axis inside the belt's extent), if any. */
export function beltOf(body: Pick<Body, "orbit" | "parentId">): Belt | null {
	if (body.orbit === null) return null
	const a = body.orbit.semiMajorAxisKm
	return (
		belts.find(
			(belt) =>
				belt.parentId === body.parentId &&
				a >= belt.extentKm[0] &&
				a <= belt.extentKm[1],
		) ?? null
	)
}

/** A length for a sentence: "1 million km", "60 million km", "400,000 km". */
export function lengthText(km: number, i18n: I18n): string {
	return km >= 1e6
		? i18n.t("units.millionKm", { value: roughly(km / 1e6) })
		: i18n.quantity(roughly(km), "kilometer")
}

export interface BeltSentences {
	name: string
	perDot: string
	spacing: string
	dotSize: string
}

/** What a belt's dots stand for and how far apart its members really are. */
export function beltSentences(belt: Belt, i18n: I18n): BeltSentences {
	return {
		name: i18n.t("solarSystem.smallBodies.beltName", { belt: belt.id }),
		perDot: i18n.t("solarSystem.smallBodies.perDot", {
			belt: belt.id,
			count: roughly(belt.members.count / belt.dots),
			size: i18n.quantity(belt.members.minDiameterKm, "kilometer"),
			total: i18n.number(belt.members.count),
		}),
		spacing: i18n.t("solarSystem.smallBodies.spacing", {
			distance: lengthText(belt.meanSeparationKm, i18n),
			moons: roughly(belt.meanSeparationKm / EARTH_MOON_KM),
		}),
		dotSize: i18n.t("solarSystem.smallBodies.dotSize"),
	}
}

export interface CometSentences {
	where: string
	tail: string
	perihelion: string
}

const now: Vec3 = { x: 0, y: 0, z: 0 }
const later: Vec3 = { x: 0, y: 0, z: 0 }

/** Where a comet is at `jd`, what its tail is doing and when it is next (or was last) closest to the Sun. */
export function cometSentences(
	body: Pick<Body, "orbit" | "tail">,
	jd: number,
	i18n: I18n,
): CometSentences | null {
	const orbit = body.orbit
	if (orbit === null) return null
	propagate(orbit, jd, now)
	propagate(orbit, jd + 0.01, later)
	const r = Math.hypot(now.x, now.y, now.z)
	const direction = Math.hypot(later.x, later.y, later.z) < r ? "in" : "out"
	const au = r / AU_KM
	const where = i18n.t("solarSystem.smallBodies.comet.where", {
		distance: i18n.t("units.au", {
			value: i18n.significant(au, au < 10 ? 2 : 3),
		}),
		direction,
	})
	const length = body.tail === undefined ? 0 : tailLengthKm(body.tail, r)
	const tail =
		length > 0
			? i18n.t("solarSystem.smallBodies.comet.tail", {
					length: lengthText(length, i18n),
					direction,
				})
			: i18n.t("solarSystem.smallBodies.comet.noTail", {
					onset: i18n.t("units.au", {
						value: i18n.number(TAIL_ONSET_KM / AU_KM),
					}),
				})
	const next = nextPerihelionJD(orbit, jd)
	const day = (at: number) => formatDayUTC(jdToDate(at), i18n.formatLocale)
	const perihelion =
		next <= LATEST_WATCH_JD
			? i18n.t("solarSystem.smallBodies.comet.next", { date: day(next) })
			: i18n.t("solarSystem.smallBodies.comet.last", {
					date: day(previousPerihelionJD(orbit, jd)),
					years: roughly((next - jd) / 365.25),
				})
	return { where, tail, perihelion }
}
