import * as React from "react"
import { Box, createStyles, Text } from "@mantine/core"
import { blurUpIn } from "../keyframes/blurUpIn"

const useStyles = createStyles(() => ({
	labelContainer: {
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		letterSpacing: "4px",
		fontSize: "12px",
		color: "gray",
		textTransform: "uppercase",
	},
	littleBar: {
		margin: "0 5px 0 1px",
		width: "30px",
		height: "2.5px",
		backgroundColor: "gray",
	},

	text: {
		fontSize: "30px",
		color: "white",
		fontWeight: "bold",
		padding: "5px 0 5px",
		letterSpacing: "1px",
		opacity: "1",
		animation: `${blurUpIn} 0.8s`,
	},
	extra: {
		padding: "0 0 30px",
	},
	smallText: {
		fontSize: "20px",
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
