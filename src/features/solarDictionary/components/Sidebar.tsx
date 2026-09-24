import { FC, useEffect, useRef } from "react"
import { Box, Text } from "@mantine/core"
import gsap from "gsap"
import { blurUpIn } from "../keyframes/blurUpIn"
import classes from "./Sidebar.module.css"

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
	const textRefs = useRef<HTMLElement[]>([])
	const textRef = (el: HTMLElement | null) => {
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
								className={
									/name/i.test(label)
										? `${classes.text} ${classes.largeText}`
										: classes.text
								}
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
