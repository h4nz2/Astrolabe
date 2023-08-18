import { NexusGenObjects } from "generated/nexus-typegen-custom"
import { OurDatabase } from "../db"

export const getAllCelestialBodies = async (
	ourDatabase: OurDatabase,
): Promise<NexusGenObjects["CelestialBody"][]> => {
	const mapCelestialBodies = (
		body: Required<NexusGenObjects["CelestialBody"]>[],
	) =>
		body.map((b): NexusGenObjects["CelestialBody"] => ({
			id: b.id,
			name: b.name,
			isPlanet: b.isPlanet,
			gravity: b.gravity,
			diameter: b.diameter,
			bodyType: b.bodyType,
			mass: b.mass,
			// distanceFromParent: b.distanceFromParent ?? 0,
		}))

	const { suns, planets, dwarfPlanets } = ourDatabase

	return [
		...mapCelestialBodies(suns),
		...mapCelestialBodies(planets),
		...mapCelestialBodies(dwarfPlanets),
	]
}
