import { createRootRoute, Link, Outlet } from "@tanstack/react-router"
import { Button, Center, Stack, Text, Title } from "@mantine/core"

import Providers from "@/providers"

function RootLayout() {
	return (
		<Providers>
			<Outlet />
		</Providers>
	)
}

// Rendered in place of <Outlet /> for unknown URLs, so it keeps the providers and layout.
function NotFound() {
	return (
		<Center h="100vh">
			<Stack align="center" gap="md">
				<Title order={1}>Lost in space</Title>
				<Text c="dimmed">There is nothing at this address.</Text>
				<Button
					component={Link}
					to="/"
					variant="gradient"
					gradient={{ from: "yellow", to: "red" }}
				>
					Back to the stars
				</Button>
			</Stack>
		</Center>
	)
}

export const Route = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFound,
})
