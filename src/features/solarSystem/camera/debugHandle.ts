/**
 * `window.__astrolabe` while the solar system is on screen: the store (the
 * navigation API: `select`, `focus`, `overview`, `goTo`, `playSequence`, ...)
 * and read-only camera diagnostics. It lets the navigation model be driven
 * from the browser console and from end-to-end tests without touching the
 * camera. Not an API for app code: import the store instead.
 */
import { useSimStore } from "@/store/sim"

import type { CameraDirector, CameraSnapshot } from "./director"

export interface AstrolabeDebugHandle {
	store: typeof useSimStore
	camera: () => CameraSnapshot
}

declare global {
	interface Window {
		__astrolabe?: AstrolabeDebugHandle
	}
}

/** Publishes the handle; returns the function that removes it again. */
export function exposeDebugHandle(director: CameraDirector): () => void {
	if (typeof window === "undefined") return () => undefined
	const handle: AstrolabeDebugHandle = {
		store: useSimStore,
		camera: () => director.snapshot(),
	}
	window.__astrolabe = handle
	return () => {
		if (window.__astrolabe === handle) delete window.__astrolabe
	}
}
