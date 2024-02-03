import { getTypedKeys } from "@/lib/getTypedKeys"
import { SolarDictionaryItem } from "generated/graphql"
import { SidebarLabel } from "../components/Sidebar"

const labelDetails = {
	name: { unit: "" },
	diameter: { unit: "km" },
	lengthOfDay: { unit: "h" },
	orbitalPeriod: { unit: "days" },
	gravity: { unit: "m/s^2" },
	avgTemp: { unit: "K" },
}
type LabelDetailKey = keyof typeof labelDetails

export const getSidebarLabels = (
	entity: SolarDictionaryItem,
	requiredLabels: string[],
	planetOfReference?: SolarDictionaryItem,
) =>
	(entity ? getTypedKeys(entity) : [])
		.filter((key) => requiredLabels.includes(key))
		.map(
			(key): SidebarLabel => ({
				[key]: [
					`${entity[key]} ${labelDetails[key as LabelDetailKey].unit}`,
					!planetOfReference || entity.id === planetOfReference.id
						? null
						: getExtra(key, entity[key] as number, planetOfReference),
				],
			}),
		)

function getExtra(
	key: keyof SolarDictionaryItem,
	value: number,
	planetOfReference: SolarDictionaryItem,
): string | null {
	const earthValue = planetOfReference[key] as number
	switch (key) {
		case "diameter":
			return earthSizeComparison(earthValue, value)
		case "lengthOfDay":
			return earthDays(earthValue, value)
		case "orbitalPeriod":
			return earthBirthdays(earthValue, value)
		case "gravity":
			return earthGravity(earthValue, value)
		default:
			return null
	}
}

function earthSizeComparison(earthValue: number, value: number): string {
	const earths = Number.parseFloat(
		((value / 2) ** 3 / (earthValue / 2) ** 3).toFixed(1),
	)
	if (earths > 1.5)
		return `You could fit Earth ${Math.round(earths)} times in it!`

	if (earths < 0.6)
		return `You could fit it ${Math.round(1 / earths)} times in Earth!`

	return "It is about the same size as our planet."
}

function earthDays(earthValue: number, value: number): string {
	const days = Math.round(value / earthValue)
	return `On Earth that would be ${days} days.`
}

function earthGravity(earthValue: number, value: number): string {
	const gravityRatio = Number.parseFloat((value / earthValue).toFixed(1))
	if (gravityRatio > 1) return `You would weigh ${gravityRatio} times more!`

	return `You would weigh ${(1 / gravityRatio).toFixed(1)} times less.`
}

function earthBirthdays(earthValue: number, value: number): string {
	const earthDifference = Math.round(value - earthValue)
	if (earthDifference > 0)
		return `You would have to wait extra ${earthDifference} days for your birthday :(`

	return `You would need to wait ${
		earthDifference * -1
	} days less for your birthday :)`
}
