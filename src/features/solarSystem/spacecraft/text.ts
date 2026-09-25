/**
 * Spacecraft wording shared by the HUD (issue #35): signal times in words,
 * event targets and milestone lines, in the active language. Pure: takes the
 * `I18n` object.
 */
import { bodyById } from "@/data"
import type { SpacecraftEvent } from "@/data/spacecraft"
import type { I18n } from "@/i18n"

/**
 * A duration in the largest sensible units: seconds under 90 s, minutes
 * under 90 min, else hours and minutes ("22 hours 58 minutes").
 */
export function formatSignalTime(seconds: number, i18n: I18n): string {
	if (seconds < 90) return i18n.quantity(Math.round(seconds), "second", "long")
	const minutes = Math.round(seconds / 60)
	if (minutes < 90) return i18n.quantity(minutes, "minute", "long")
	const hours = Math.floor(minutes / 60)
	return i18n.t("solarSystem.spacecraft.hours", {
		hours: i18n.quantity(hours, "hour", "long"),
		minutes: i18n.quantity(minutes - hours * 60, "minute", "long"),
	})
}

/** Name of an event target: a body's through `bodyName`, else the locale's. */
export function targetName(
	target: string | undefined,
	i18n: I18n,
	bodyName: (id: string) => string,
): string {
	if (target === undefined) return ""
	if (bodyById.has(target)) return bodyName(target)
	return i18n.t(`solarSystem.spacecraft.target.${target}` as never)
}

/** One line for an event: "Flies past Jupiter". */
export function eventLabel(
	event:
		| Pick<SpacecraftEvent, "kind" | "target">
		| { kind: "launch"; target?: string },
	i18n: I18n,
	bodyName: (id: string) => string,
): string {
	return i18n.t(`solarSystem.spacecraft.event.${event.kind}` as never, {
		targetId: event.target ?? "none",
		target: targetName(event.target, i18n, bodyName),
	})
}
