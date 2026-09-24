import { useMemo } from "react"
import {
	Select,
	type ComboboxItem,
	type ComboboxItemGroup,
	type ComboboxLikeRenderOptionInput,
} from "@mantine/core"
import { IconFocus2 } from "@tabler/icons-react"

import { bodyById, moonsOf, planets, sun, type Body } from "@/data"
import { useI18n, type I18n } from "@/i18n"
import { bodyName } from "@/i18n/bodies"
import { useSimStore } from "@/store/sim"

import { cycleFocus } from "./focusCycle"
import { hasModifier, isEditableTarget, useWindowKeydown } from "./keyboard"

import classes from "./FocusPicker.module.css"

const largestFirst = (a: Body, b: Body): number => b.radiusKm - a.radiusKm

/**
 * The Sun, then one group per planet holding the planet itself and all its
 * moons, largest first; names in the active language, so the search matches
 * "Erde" in German and "Earth" in English.
 */
export function focusOptions(
	chain: I18n["chain"],
): ComboboxItemGroup<ComboboxItem>[] {
	const toItem = (body: Body): ComboboxItem => ({
		value: body.id,
		label: bodyName(body.id, chain),
	})
	return [
		{ group: bodyName(sun.id, chain), items: [toItem(sun)] },
		...planets.map((planet) => ({
			group: bodyName(planet.id, chain),
			items: [planet, ...moonsOf(planet.id).sort(largestFirst)].map(toItem),
		})),
	]
}

/** Left/Right cycle the focus among siblings; text fields and other widgets keep their arrows. */
const handleKeyDown = (event: KeyboardEvent): void => {
	if (hasModifier(event) || isEditableTarget(event.target)) return
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
	const { focusId, setFocus } = useSimStore.getState()
	const next = cycleFocus(focusId, event.key === "ArrowRight" ? 1 : -1)
	if (next === focusId) return
	event.preventDefault()
	setFocus(next)
}

/** Searchable picker of the focused body, grouped by planet. */
const FocusPicker = () => {
	const focusId = useSimStore((state) => state.focusId)
	const setFocus = useSimStore((state) => state.setFocus)
	const i18n = useI18n()
	const { t, chain } = i18n
	const data = useMemo(() => focusOptions(chain), [chain])
	useWindowKeydown(handleKeyDown)

	const renderOption = ({
		option,
	}: ComboboxLikeRenderOptionInput<ComboboxItem>) => {
		const body = bodyById.get(option.value)
		const radius = body && i18n.quantity(body.radiusKm, "kilometer")
		return (
			<span className={classes.option}>
				<span>{option.label}</span>
				{body !== undefined && radius !== undefined && (
					<span className={classes.meta}>
						{body.radiusEstimated
							? t("units.approx", { value: radius })
							: radius}
					</span>
				)}
			</span>
		)
	}

	return (
		<Select
			className={classes.select}
			aria-label={t("solarSystem.picker.label")}
			placeholder={t("solarSystem.picker.placeholder")}
			leftSection={<IconFocus2 size={16} />}
			data={data}
			value={focusId}
			onChange={(value) => {
				if (value !== null) setFocus(value)
			}}
			renderOption={renderOption}
			searchable
			nothingFoundMessage={t("solarSystem.picker.nothingFound")}
			allowDeselect={false}
			maxDropdownHeight={320}
			comboboxProps={{ shadow: "md" }}
		/>
	)
}

export default FocusPicker
