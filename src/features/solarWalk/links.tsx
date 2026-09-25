import type { ComponentPropsWithRef } from "react"
import { createLink } from "@tanstack/react-router"
import {
	Anchor,
	Button,
	type AnchorProps,
	type ButtonProps,
} from "@mantine/core"

// Mantine's polymorphic `component={Link}` loses the router's typing of `search`;
// createLink keeps it, so a link to `/solar_system?scale=trueScale` is checked.
const AnchorBase = (props: AnchorProps & ComponentPropsWithRef<"a">) => (
	<Anchor component="a" {...props} />
)
const ButtonBase = (props: ButtonProps & ComponentPropsWithRef<"a">) => (
	<Button component="a" {...props} />
)

/** A Mantine Anchor that is a router link. */
export const AnchorLink = createLink(AnchorBase)
/** A Mantine Button that is a router link. */
export const ButtonLink = createLink(ButtonBase)
