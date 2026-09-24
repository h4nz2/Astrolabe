import { createFileRoute } from "@tanstack/react-router"

import Hero from "@/features/hero/components"

export const Route = createFileRoute("/")({ component: Hero })
