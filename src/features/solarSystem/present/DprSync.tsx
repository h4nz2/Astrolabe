import { useEffect } from "react"
import { useThree } from "@react-three/fiber"

/** The Canvas's `dpr` range (scene/Scene.tsx). */
export const DPR_RANGE: [number, number] = [1, 2]

/**
 * Second-screen aware (#29): dragging the window from a laptop to a projector
 * changes the device pixel ratio, which the Canvas reads only once. This
 * re-applies the range whenever the ratio changes, so the scene is neither
 * blurred on the sharper screen nor rendered at twice the pixels it needs on
 * the other. (Size changes are the Canvas's own resize handling.)
 */
function DprSync() {
	const setDpr = useThree((state) => state.setDpr)
	useEffect(() => {
		if (typeof window.matchMedia !== "function") return
		let query: MediaQueryList | null = null
		const watch = () => {
			query?.removeEventListener("change", changed)
			query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
			query.addEventListener("change", changed)
		}
		function changed() {
			setDpr(DPR_RANGE)
			watch()
		}
		watch()
		return () => query?.removeEventListener("change", changed)
	}, [setDpr])
	return null
}

export default DprSync
