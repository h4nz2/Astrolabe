import * as React from "react"
import { Box, createStyles, Text } from "@mantine/core"
import { blurUpIn } from "../keyframes/blurUpIn"

const useStyles = createStyles(() => ({
	labelContainer: {
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		letterSpacing: "4px",
		fontSize: "clamp(calc(0.75rem/2), 2.5vw, 0.75rem)",
		color: "gray",
		textTransform: "uppercase",
	},
	littleBar: {
		margin: "0 5px 0 1px",
		flex: 1,
		height: "2.5px",
		backgroundColor: "gray",
	},

	text: {
		fontSize: "clamp(1rem, 2.5vw, 2rem)",
		color: "white",
		fontWeight: "bold",
		letterSpacing: "clamp(0.125rem, 2.5vw, 0.25rem)",
		opacity: "1",
		animation: `${blurUpIn} 0.8s`,
	},
	extra: {
		paddingBottom: "clamp(0.125rem, 2.5vw, 0.25rem)",
	},
	smallText: {
		fontSize: "clamp(calc(1.25rem / 2), 2.5vw, 1.25rem)",
	},
}))

export type StageLabelProps = {
	label?: string | number | null
	text?: string | number | null
	extra?: string | null
	small?: boolean
}

const StageLabel: React.FC<StageLabelProps> = ({
	label,
	text,
	extra,
	small,
}) => {
	const { classes, cx } = useStyles()
	if (!label && !text) return null
	return (
		<Box>
			<Box className={classes.labelContainer}>
				<Box className={classes.littleBar} />
				{label}
				<Box className={classes.littleBar} />
			</Box>

			<Text className={cx(classes.text, { [classes.smallText]: !!small })}>
				{text}
			</Text>
			{extra ? <Text className={classes.extra}>{extra}</Text> : null}
		</Box>
	)
}

export default StageLabel
