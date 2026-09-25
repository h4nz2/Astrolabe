/**
 * Plays a recording (`recordings.ts`) through the recordings bus. Call
 * `playRecording` from the Listen button's click handler: browsers only start
 * media from a user gesture. The store's `playing` is the truth; the sound
 * director calls `stopPlayback` whenever it no longer names this element's
 * recording (Stop, mute, another recording).
 */
import { useSoundStore } from "@/store/sound"
import { assetUrl } from "@/utils/assetUrl"

import { unlockAudio } from "./engine"
import { recordingById } from "./recordings"

interface Playback {
	id: string
	element: HTMLAudioElement
	source: MediaElementAudioSourceNode | null
}

let current: Playback | null = null

/** The recording whose audio element is live, if any. */
export const playbackId = (): string | null => current?.id ?? null

export function stopPlayback(): void {
	if (current === null) return
	const { element, source } = current
	current = null
	element.pause()
	source?.disconnect()
	element.removeAttribute("src")
	element.load()
}

/** Starts recording `id` (turning sound on); another one playing stops first. */
export function playRecording(id: string): void {
	const recording = recordingById.get(id)
	if (recording === undefined || typeof Audio === "undefined") return
	stopPlayback()
	const engine = unlockAudio()
	const element = new Audio(assetUrl(recording.file))
	element.preload = "auto"
	let source: MediaElementAudioSourceNode | null = null
	if (engine !== null) {
		try {
			source = engine.ctx.createMediaElementSource(element)
			source.connect(engine.recordings)
		} catch {
			source = null
		}
	}
	if (source === null) element.volume = useSoundStore.getState().volume
	const playback: Playback = { id, element, source }
	current = playback
	const finish = () => {
		if (current !== playback) return
		stopPlayback()
		if (useSoundStore.getState().playing === id) {
			useSoundStore.getState().setPlaying(null)
		}
	}
	element.addEventListener("ended", finish)
	element.addEventListener("error", finish)
	useSoundStore.getState().setPlaying(id)
	void element.play().catch(finish)
}
