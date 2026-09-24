import {
	Select,
	type ComboboxItem,
	type ComboboxItemGroup,
	type ComboboxLikeRenderOptionInput,
} from "@mantine/core"
import { IconFocus2 } from "@tabler/icons-react"

import { bodyById, moonsOf, planets, sun, type Body } from "@/data"
import { useSimStore } from "@/store/sim"

import { cycleFocus } from "./focusCycle"
import { formatNumber } from "./format"
import { hasModifier, isEditableTarget, useWindowKeydown } from "./keyboard"

import classes from "./FocusPicker.module.css"

const toItem = (body: Body): ComboboxItem => ({
	value: body.id,
	label: body.name,
})

const largestFirst = (a: Body, b: Body): number => b.radiusKm - a.radiusKm

/** The Sun, then one group per planet holding the planet itself and all its moons, largest first. */
export const focusOptions: ComboboxItemGroup<ComboboxItem>[] = [
	{ group: sun.name, items: [toItem(sun)] },
	...planets.map((planet) => ({
		group: planet.name,
		items: [planet, ...moonsOf(planet.id).sort(largestFirst)].map(toItem),
	})),
]

const renderOption = ({
	option,
}: ComboboxLikeRenderOptionInput<ComboboxItem>) => {
	const body = bodyById.get(option.value)
	return (
		<span className={classes.option}>
			<span>{option.label}</span>
			{body !== undefined && (
				<span className={classes.meta}>
					{body.radiusEstimated ? "≈ " : ""}
					{formatNumber(body.radiusKm)} km
				</span>
			)}
		</span>
	)
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
	useWindowKeydown(handleKeyDown)

	return (
		<Select
			className={classes.select}
			aria-label="Focus body"
			placeholder="Focus a body…"
			leftSection={<IconFocus2 size={16} />}
			data={focusOptions}
			value={focusId}
			onChange={(value) => {
				if (value !== null) setFocus(value)
			}}
			renderOption={renderOption}
			searchable
			nothingFoundMessage="No such body"
			allowDeselect={false}
			maxDropdownHeight={320}
			comboboxProps={{ shadow: "md" }}
		/>
	)
}

export default FocusPicker
