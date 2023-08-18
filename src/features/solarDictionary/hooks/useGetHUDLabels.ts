import { getTypedKeys } from "@/lib/getTypedKeys"
import { SolarDictionaryItem } from "generated/graphql"
import * as React from "react"

type Label = { [key: string]: [string | number, string | null] }

const labelDetails = {
	name: { unit: "" },
	diameter: { unit: "km" },
	lengthOfDay: { unit: "h" },
	orbitalPeriod: { unit: "days" },
	gravity: { unit: "m/s^2" },
	avgTemp: { unit: "K" },
}
// it would probably be better to fetch those from our DB instead
// const { data, loading } = useSolarDictionaryQuery()
// const solarDict = data?.solarDictionary
const earthValues = {
	id: 3,
	name: "Earth",
	diameter: 12756,
	lengthOfDay: 24,
	distanceFromParent: 149600000,
	orbitalPeriod: 365.2,
	orbitalVelocity: 29.8,
	orbitalInclination: 0,
	orbitPositionOffset: 0,
	rings: false,
	textures: {
		base: "/assets/textures/earth_4k.jpg",
		topo: "/assets/textures/earth_topo_4k.jpg",
		specular: "/assets/textures/earth_ocean_reflectance_10k.jpg",
		clouds: "/assets/textures/earth_clouds_active2.png",
	},
	isPlanet: true,
	moons: [
		{
			id: "3a",
			name: "Moon",
			diameter: 3476.2,
			distanceFromParent: 384400,
			orbitalPeriod: 27.3,
			orbitalInclination: 21,
			surfaceTemps: {
				min: -110,
				max: 130,
			},
			textures: {
				base: "/assets/textures/earth/satellites/moon_1k.jpg",
				topo: "/assets/textures/earth/satellites/moon_topo_1k.jpg",
			},

			isPlanet: false,
			moons: null,
			semimajorAxis: 384400,
			perihelion: 363300,
			aphelion: 405500,
			eccentricity: 0.0549,
			inclination: 5.145,
			mass: {
				massValue: 7.346,
				massExponent: 22,
			},
			vol: {
				volValue: 2.1968,
				volExponent: 10,
			},
			density: 3.344,
			gravity: 1.62,
			escape: 2380,
			meanRadius: 1737,
			equaRadius: 1738.1,
			polarRadius: 1736,
			flattening: 0.0012,
			dimension: "",
			sideralOrbit: 27.3217,
			sideralRotation: 655.728,
			aroundPlanet: {
				planet: "terre",
				rel: "https://api.le-systeme-solaire.net/rest/bodies/terre",
			},
			discoveredBy: "",
			discoveryDate: "",
			alternativeName: "",
			axialTilt: 6.68,
			avgTemp: 0,
			mainAnomaly: 0,
			argPeriapsis: 0,
			longAscNode: 0,
			bodyType: "Moon",
			rel: "https://api.le-systeme-solaire.net/rest/bodies/lune",
		},
		{
			ISS: {
				id: "3b",
				distanceFromParent: 400,
			},
		},
	],
	semimajorAxis: 149598023,
	perihelion: 147095000,
	aphelion: 152100000,
	eccentricity: 0.0167,
	inclination: 0,
	mass: {
		massValue: 5.97237,
		massExponent: 24,
	},
	vol: {
		volValue: 1.08321,
		volExponent: 12,
	},
	density: 5.5136,
	gravity: 9.8,
	escape: 11190,
	meanRadius: 6371.0084,
	equaRadius: 6378.1366,
	polarRadius: 6356.8,
	flattening: 0.00335,
	dimension: "",
	sideralOrbit: 365.256,
	sideralRotation: 23.9345,
	aroundPlanet: null,
	discoveredBy: "",
	discoveryDate: "",
	alternativeName: "",
	axialTilt: 23.4393,
	avgTemp: 288,
	mainAnomaly: 358.617,
	argPeriapsis: 85.901,
	longAscNode: 18.272,
	bodyType: "Planet",
}

export const useGetHUDLabels = (
	entity: SolarDictionaryItem,
	requiredLabels: string[],
) => {
	const labels = React.useMemo(
		() =>
			getTypedKeys(entity)
				.filter((key) => requiredLabels.includes(key))
				.map((key) => {
					return {
						[key]: [
							`${entity[key]} ${
								labelDetails[key as keyof typeof labelDetails].unit
							}`,
							getExtra(key, entity[key]),
						],
					} as Label
				}),
		[entity, requiredLabels],
	)

	return labels
}

function getExtra(key: string, value: any): String | null {
	const earthValue = earthValues[key as keyof typeof earthValues]
	switch (key) {
		case "diameter":
			return earthSizeComparison(earthValue as number, value)
		case "lengthOfDay":
			return earthDays(earthValue as number, value)
		case "orbitalPeriod":
			return earthBirthdays(earthValue as number, value)
		case "gravity":
			return earthGravity(earthValue as number, value)
		default:
			return null
	}
}

function earthSizeComparison(earthValue: number, value: number): String {
	const earths = Number.parseFloat(
		((value / 2) ** 3 / (earthValue / 2) ** 3).toFixed(1),
	)
	if (earths > 1.5) {
		return `You could fit Earth ${Math.round(earths)} times in it!`
	} else if (earths < 0.6) {
		return `You could fit it ${Math.round(1 / earths)} times in Earth!`
	} else {
		return "It is about the same size as our planet."
	}
}

function earthDays(earthValue: number, value: number): String {
	const days = Math.round(value / earthValue)
	return `On Earth that would be ${days} days.`
}

function earthGravity(earthValue: number, value: number): String {
	const gravityRatio = Number.parseFloat((value / earthValue).toFixed(1))
	if (gravityRatio > 1) {
		return `You would weigh ${gravityRatio} times more!`
	} else {
		return `You would weigh ${(1 / gravityRatio).toFixed(1)} times less.`
	}
}

function earthBirthdays(earthValue: number, value: number): String {
	const earthDifference = Math.round(value - earthValue)
	if (earthDifference > 0) {
		return `You would have to wait extra ${earthDifference} days for your birthday :(`
	} else {
		return `You would need to wait ${
			earthDifference * -1
		} days less for your birthday :)`
	}
}
