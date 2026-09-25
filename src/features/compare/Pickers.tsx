/**
 * Choosing what to compare (#24), never by typing: "Compare [Earth] with
 * [Jupiter]", a swap button, the further bodies as removable chips, a picker
 * to add one, and ready-made ideas for a lesson ("The Sun and Earth", "All
 * eight planets"). The pickers list every body grouped by planet, the same
 * list as the solar system's focus picker (`focusOptions`).
 */
import { Fragment, useMemo } from "react"
import {
	ActionIcon,
	Button,
	CloseButton,
	Menu,
	Select,
	Tooltip,
	type ComboboxItem,
	type ComboboxItemGroup,
} from "@mantine/core"
import { IconArrowsExchange, IconBulb, IconPlus } from "@tabler/icons-react"

import { useI18n } from "@/i18n"
import { useBodyName } from "@/i18n/bodies"

import { focusOptions } from "../solarSystem/ui/FocusPicker"
import {
	COMPARE_PRESET_GROUPS,
	COMPARE_PRESETS,
	MAX_COMPARE,
	addBody,
	promote,
	removeBody,
	replaceAt,
	swapPair,
} from "./selection"

import classes from "./Compare.module.css"

export interface PickersProps {
	ids: readonly string[]
	onChange: (ids: string[]) => void
}

const withDisabled = (
	groups: ComboboxItemGroup<ComboboxItem>[],
	taken: readonly string[],
): ComboboxItemGroup<ComboboxItem>[] =>
	groups.map((group) => ({
		...group,
		items: group.items.map((item) => ({
			...item,
			disabled: taken.includes(item.value),
		})),
	}))

const Pickers = ({ ids, onChange }: PickersProps) => {
	const { t, chain } = useI18n()
	const name = useBodyName()
	const options = useMemo(() => focusOptions(chain), [chain])
	const addOptions = useMemo(() => withDisabled(options, ids), [options, ids])
	const full = ids.length >= MAX_COMPARE
	const select = {
		data: options,
		searchable: true,
		allowDeselect: false,
		maxDropdownHeight: 320,
		comboboxProps: { shadow: "md" },
		nothingFoundMessage: t("solarSystem.picker.nothingFound"),
		className: classes.select,
	} as const

	return (
		<div className={classes.pickers}>
			<span className={classes.pickWord}>{t("compare.pick.compare")}</span>
			<Select
				{...select}
				aria-label={t("compare.pick.first")}
				value={ids[0]}
				onChange={(id) => id !== null && onChange(replaceAt(ids, 0, id))}
				data-testid="compare-first"
			/>
			<span className={classes.pickWord}>{t("compare.pick.with")}</span>
			<Select
				{...select}
				aria-label={t("compare.pick.second")}
				value={ids[1]}
				onChange={(id) => id !== null && onChange(replaceAt(ids, 1, id))}
				data-testid="compare-second"
			/>
			<Tooltip label={t("compare.pick.swap")} openDelay={300}>
				<ActionIcon
					variant="light"
					color="gray"
					size="lg"
					aria-label={t("compare.pick.swap")}
					onClick={() => onChange(swapPair(ids))}
				>
					<IconArrowsExchange size={18} />
				</ActionIcon>
			</Tooltip>
			{ids.slice(2).map((id) => (
				// the further bodies: a click compares with it, the cross removes it
				<span key={id} className={classes.chip} data-body={id}>
					<button
						type="button"
						className={classes.chipName}
						aria-label={t("compare.stage.pick", { nameId: id, name: name(id) })}
						onClick={() => onChange(promote(ids, id))}
					>
						{name(id)}
					</button>
					<CloseButton
						size="sm"
						aria-label={t("compare.pick.remove", { name: name(id) })}
						onClick={() => onChange(removeBody(ids, id))}
					/>
				</span>
			))}
			<Select
				{...select}
				data={addOptions}
				aria-label={t("compare.pick.add")}
				placeholder={
					full
						? t("compare.pick.full", { max: MAX_COMPARE })
						: t("compare.pick.addPlaceholder")
				}
				leftSection={<IconPlus size={16} />}
				value={null}
				disabled={full}
				onChange={(id) => id !== null && onChange(addBody(ids, id))}
				className={`${classes.select} ${classes.add}`}
				data-testid="compare-add"
			/>
			<Menu shadow="md" position="bottom-end" width={360}>
				<Menu.Target>
					<Button
						variant="light"
						color="orange"
						leftSection={<IconBulb size={16} />}
						data-testid="compare-presets"
					>
						{t("compare.pick.presets")}
					</Button>
				</Menu.Target>
				<Menu.Dropdown className={classes.ideas}>
					{COMPARE_PRESET_GROUPS.map((group) => (
						// ideas grouped so a dozen stay easy to scan (#40)
						<Fragment key={group}>
							<Menu.Label>{t(`compare.ideaGroups.${group}`)}</Menu.Label>
							{COMPARE_PRESETS.filter((preset) => preset.group === group).map(
								(preset) => (
									<Menu.Item
										key={preset.id}
										data-idea={preset.id}
										onClick={() => onChange([...preset.bodies])}
									>
										<span className={classes.ideaName}>
											{t(`compare.presets.${preset.id}`)}
										</span>
										<span className={classes.ideaTeaser}>
											{t(`compare.teasers.${preset.id}`)}
										</span>
									</Menu.Item>
								),
							)}
						</Fragment>
					))}
				</Menu.Dropdown>
			</Menu>
		</div>
	)
}

export default Pickers
