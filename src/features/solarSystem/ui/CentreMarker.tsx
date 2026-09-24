import { useSimStore } from "@/store/sim"

import { freeCentreId } from "./centre"

import classes from "./CentreMarker.module.css"

/**
 * Marks the point the camera orbits while it is not a body (#15): during a
 * pan, and while the view is a free point in space. Without it, orbiting
 * around empty space looks like the whole solar system is wobbling.
 */
const CentreMarker = () => {
	const visible = useSimStore(
		(state) => state.panning || freeCentreId(state) !== null,
	)
	return (
		<svg
			className={`${classes.marker} ${visible ? classes.visible : ""}`}
			viewBox="0 0 28 28"
			aria-hidden
			data-testid="centre-marker"
			data-visible={visible}
		>
			<circle
				cx="14"
				cy="14"
				r="6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M14 1v6M14 21v6M1 14h6M21 14h6"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	)
}

export default CentreMarker
