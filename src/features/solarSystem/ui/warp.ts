import type { I18n } from "@/i18n"
import { WARP_PRESETS } from "@/store/sim"

/** Which way the clock runs: `1` forwards, `-1` backwards. */
export type Direction = 1 | -1

/** The direction a warp runs the clock in (0 counts as forwards). */
export const directionOf = (warp: number): Direction => (warp < 0 ? -1 : 1)

/** `warp` running in `direction`, at the same speed. */
export const withDirection = (warp: number, direction: Direction): number =>
	direction * Math.abs(warp)

/**
 * The next faster (`1`) or slower (`-1`) preset from `current`, keeping its
 * direction, so "+" speeds up a reversed clock too (-1 day/s -> -1 week/s).
 * Walks the presets even from a speed that is none of them (a hand-edited
 * URL). Stays put at either end.
 */
export function stepWarp(current: number, step: 1 | -1): number {
	const speed = Math.abs(current)
	let next: number | undefined
	if (step === 1) {
		next = WARP_PRESETS.find((preset) => preset > speed)
	} else {
		for (let i = WARP_PRESETS.length - 1; i >= 0; i -= 1) {
			if (WARP_PRESETS[i] < speed) {
				next = WARP_PRESETS[i]
				break
			}
		}
	}
	return next === undefined
		? current
		: withDirection(next, directionOf(current))
}

/** Simulated time units a warp is named in, largest first (seconds each). */
export const WARP_UNITS = [
	["year", 31557600],
	["month", 2629800],
	["week", 604800],
	["day", 86400],
	["hour", 3600],
	["minute", 60],
] as const

export type WarpUnit = (typeof WARP_UNITS)[number][0]

export type WarpParts =
	| { kind: "realTime" }
	| { kind: "unit"; unit: WarpUnit; count: number }
	| { kind: "factor"; factor: number }

/**
 * How a warp (simulated seconds per real second) reads: real time, a whole
 * number of the largest fitting unit per second (86400 -> 1 day/s, 120 -> 2 min/s,
 * -86400 -> -1 day/s), or a bare factor (100 -> 100x).
 */
export function warpParts(value: number): WarpParts {
	if (value === 1) return { kind: "realTime" }
	for (const [unit, seconds] of WARP_UNITS) {
		if (value !== 0 && value % seconds === 0) {
			return { kind: "unit", unit, count: value / seconds }
		}
	}
	return { kind: "factor", factor: value }
}

/** The warp's label in the active language: "1x", "1 day/s" / "1 Tag/s", "100x". */
export function warpLabel(value: number, i18n: Pick<I18n, "t" | "number">) {
	const parts = warpParts(value)
	switch (parts.kind) {
		case "realTime":
			return i18n.t("solarSystem.time.warp.realTime")
		case "unit":
			return i18n.t(`solarSystem.time.warp.${parts.unit}`, {
				count: parts.count,
			})
		case "factor":
			return i18n.t("solarSystem.time.warp.factor", {
				factor: i18n.number(parts.factor),
			})
	}
}
