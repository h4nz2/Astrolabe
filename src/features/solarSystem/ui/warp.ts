import type { I18n } from "@/i18n"
import { WARP_PRESETS } from "@/store/sim"

/**
 * The next preset above (`1`) or below (`-1`) `current`, so "+" and "-" walk the
 * presets even from a warp that is none of them (a hand-edited URL). Stays put
 * at either end.
 */
export function stepWarp(current: number, direction: 1 | -1): number {
	if (direction === 1) {
		return (
			WARP_PRESETS.find((preset) => preset.value > current)?.value ?? current
		)
	}
	for (let i = WARP_PRESETS.length - 1; i >= 0; i -= 1) {
		if (WARP_PRESETS[i].value < current) return WARP_PRESETS[i].value
	}
	return current
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
