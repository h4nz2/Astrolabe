/**
 * Condition-based waits for the WebGL scene. Headless chromium draws the scene
 * with software WebGL (swiftshader), and on a loaded machine a single frame can
 * take a second or more, so these wait for rendered frames and for the camera
 * to come to rest instead of for a fixed number of milliseconds.
 */
import type { Page } from "@playwright/test"

/** Resolves once the browser has drawn `count` more animation frames. */
export const nextFrames = (page: Page, count = 3): Promise<void> =>
	page.evaluate(
		(count) =>
			new Promise<void>((resolve) => {
				let left = count
				const step = () => {
					left -= 1
					if (left <= 0) resolve()
					else requestAnimationFrame(step)
				}
				requestAnimationFrame(step)
			}),
		count,
	)

/**
 * Waits until the solar system is on screen and its camera has come to rest:
 * no transition runs and the camera's pose round its pivot (distance, azimuth,
 * elevation) has stayed the same for `frames` consecutive frames, which also
 * lets the scene draw that many frames at rest before the picture is judged.
 */
export const cameraAtRest = (page: Page, frames = 3): Promise<unknown> =>
	page.waitForFunction(
		(frames) => {
			const handle = window.__astrolabe
			if (handle === undefined) return false
			const camera = handle.camera()
			const probe = window as unknown as { restPose?: string; restFor?: number }
			const pose = [camera.distance, camera.azimuthDeg, camera.elevationDeg]
				.map((value) => value.toPrecision(6))
				.join()
			const moving =
				camera.transitionId !== null ||
				handle.store.getState().transition !== null ||
				pose !== probe.restPose
			probe.restPose = pose
			probe.restFor = moving ? 0 : (probe.restFor ?? 0) + 1
			return probe.restFor >= frames
		},
		frames,
		{ polling: "raf" },
	)
