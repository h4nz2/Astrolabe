import { createFileRoute } from "@tanstack/react-router"

import SolarSystem from "@/features/solarSystem"

export const Route = createFileRoute("/solar_system")({
	component: SolarSystem,
})
