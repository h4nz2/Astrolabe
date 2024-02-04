import { FC, useEffect, useRef } from "react"
import { Box, createStyles, Text } from "@mantine/core"
import { blurUpIn } from "../keyframes/blurUpIn"
import gsap from "gsap"

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
		fontSize: "clamp(0.5rem, 2.5vw, 1rem)",
		color: "white",
		fontWeight: "bold",
		letterSpacing: "clamp(0.125rem, 2.5vw, 0.25rem)",
	},
	largeText: { fontSize: "clamp(1rem, 2.5vw, 2rem)" },
	extra: {
		paddingBottom: "clamp(0.125rem, 2.5vw, 0.25rem)",
		fontWeight: 200,
		letterSpacing: 1,
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

const Sidebar: FC<StageLabelProps> = ({ labels }) => {
	const { classes, cx } = useStyles()
	const textRefs = useRef<HTMLDivElement[]>([])
	const textRef = (el: HTMLDivElement) => {
		if (el && !textRefs.current.includes(el)) textRefs.current.push(el)
	}

	useEffect(() => {
		gsap.fromTo(
			textRefs.current,
			{ alpha: 0 },
			{
				alpha: 1,
				keyframes: blurUpIn,
				duration: 0.5,
				stagger: 0.025,
			},
		)
	}, [labels])

	return (
		<Box className={classes.base}>
			{labels.map((label) =>
				Object.entries(label).map(([label, [text, extra]], i) =>
					text ? (
						<Box key={i}>
							<Box ref={textRef} className={classes.label}>
								<Box className={classes.littleBar} />
								{label}
								<Box className={classes.littleBar} />
							</Box>

							<Text
								ref={textRef}
								className={cx(classes.text, {
									[classes.largeText]: /name/i.test(label),
								})}
							>
								{formatTextNumbers(text)}
								{extra ? (
									<>
										<br />
										<span className={classes.extra}>
											{formatTextNumbers(extra)}
										</span>
									</>
								) : null}
							</Text>
						</Box>
					) : null,
				),
			)}
		</Box>
	)
}

export default Sidebar
