import * as React from "react"
import { Box, createStyles, Text } from "@mantine/core"
import { blurUpIn } from "../keyframes/blurUpIn"

const useStyles = createStyles(() => ({
	base: {
		position: "fixed",
		top: "10rem",
		left: "2rem",
		fontFamily: "arial",
		width: "20ch",
		display: "flex",
		flexDirection: "column",
	},
	littleBar: {
		margin: "0 5px 0 1px",
		flex: 1,
		height: "2.5px",
		backgroundColor: "gray",
	},
	label: {
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		letterSpacing: "4px",
		fontSize: "clamp(calc(0.75rem/2), 2.5vw, 0.75rem)",
		color: "gray",
		textTransform: "uppercase",
	},
	text: {
		fontSize: "clamp(1rem, 2.5vw, 2rem)",
		color: "white",
		fontWeight: "bold",
		letterSpacing: "clamp(0.125rem, 2.5vw, 0.25rem)",
		opacity: "1",
		animation: `${blurUpIn} 0.8s`,
	},
	smallText: {
		fontSize: "clamp(0.5rem, 2.5vw, 1rem)",
	},
	extra: {
		paddingBottom: "clamp(0.125rem, 2.5vw, 0.25rem)",
	},
}))

export type SidebarLabel = { [key: string]: [string, string | null] }

export type StageLabelProps = {
	labels: SidebarLabel[]
}

const formatTextNumbers = (value?: string | number | null) =>
	value
		?.toString()
		.split(" ")
		.map((str) =>
			Number(str) ? new Intl.NumberFormat().format(Number(str)) : str,
		)
		.join(" ")

const Sidebar: React.FC<StageLabelProps> = ({ labels }) => {
	const { classes, cx } = useStyles()
	return (
		<Box className={classes.base}>
			{labels.map((label) =>
				Object.entries(label).map(([label, [text, extra]], i) =>
					text ? (
						<Box key={i}>
							<Box className={classes.label}>
								<Box className={classes.littleBar} />
								{label}
								<Box className={classes.littleBar} />
							</Box>

							<Text
								className={cx(classes.text, {
									[classes.smallText]: !/name/i.test(label),
								})}
							>
								{formatTextNumbers(text)}
							</Text>
							{extra ? <Text className={classes.extra}>{extra}</Text> : null}
						</Box>
					) : null,
				),
			)}
		</Box>
	)
}

export default Sidebar
