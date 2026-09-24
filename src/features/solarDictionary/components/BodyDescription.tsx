import type { FC } from "react"

import { useBodyText } from "@/i18n/bodies"

import classes from "./BodyDescription.module.css"

export type BodyDescriptionProps = { bodyId: string }

/** The body's tagline and written description at the active language and reading level. */
const BodyDescription: FC<BodyDescriptionProps> = ({ bodyId }) => {
	const { name, tagline, description } = useBodyText(bodyId)
	if (description === "") return null
	return (
		<section className={classes.root} aria-label={name}>
			<p className={classes.tagline}>{tagline}</p>
			<p className={classes.description}>{description}</p>
		</section>
	)
}

export default BodyDescription
