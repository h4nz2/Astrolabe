import { WARP_PRESETS } from "@/store/sim"

import { formatNumber } from "./format"

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

/** The preset's label, or `<n>x` for a warp that is not a preset. */
export const warpLabel = (value: number): string =>
	WARP_PRESETS.find((preset) => preset.value === value)?.label ??
	`${formatNumber(value)}x`
