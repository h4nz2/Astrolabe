import * as React from "react"
import {
	Container,
	Center,
	Loader as MantineLoader,
	type DefaultMantineColor,
} from "@mantine/core"

export type LoaderProps = {
	color?: DefaultMantineColor
}

const Loader: React.FC<LoaderProps> = ({ color }) => {
	return (
		<Container fluid>
			<Center h="100vh">
				<MantineLoader color={color ?? "orange"} type="bars" />
			</Center>
		</Container>
	)
}

export default Loader
