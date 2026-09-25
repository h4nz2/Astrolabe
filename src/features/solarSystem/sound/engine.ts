/**
 * The one AudioContext (#32) and its buses:
 *
 *   ambient ─┐
 *   cues ────┼─> master (volume, fades) ─> limiter ─> speakers
 *   recordings┘
 *
 * Browsers only let a page make sound after the viewer has clicked or typed
 * (autoplay policy), and a classroom must never be surprised anyway, so the
 * context is created and resumed only by `unlockAudio()`, which the UI calls
 * inside its own click and key handlers. Until then `getEngine()` is null and
 * every cue is a silent no-op. While sound is off the context is suspended:
 * no audio thread work at all.
 */

export interface SoundEngine {
	readonly ctx: AudioContext
	/** Volume and the on/off fade. */
	readonly master: GainNode
	readonly ambient: GainNode
	readonly cues: GainNode
	readonly recordings: GainNode
}

/** Bus levels relative to the master: the bed stays under everything. */
export const AMBIENT_LEVEL = 0.35
export const CUES_LEVEL = 0.8
export const RECORDINGS_LEVEL = 1
/** The bed while a recording plays. */
export const AMBIENT_DUCKED = 0.08

let engine: SoundEngine | null = null

type AudioContextCtor = new () => AudioContext

const contextCtor = (): AudioContextCtor | null => {
	if (typeof window === "undefined") return null
	const w = window as unknown as {
		AudioContext?: AudioContextCtor
		webkitAudioContext?: AudioContextCtor
	}
	return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** Web Audio exists in this browser. */
export const canPlaySound = (): boolean => contextCtor() !== null

/** The engine once audio was unlocked by a gesture, else null. */
export const getEngine = (): SoundEngine | null => engine

function build(ctx: AudioContext): SoundEngine {
	const limiter = ctx.createDynamicsCompressor()
	limiter.threshold.value = -12
	limiter.knee.value = 6
	limiter.ratio.value = 12
	limiter.attack.value = 0.003
	limiter.release.value = 0.25
	limiter.connect(ctx.destination)
	const master = ctx.createGain()
	master.gain.value = 0
	master.connect(limiter)
	const bus = (level: number) => {
		const gain = ctx.createGain()
		gain.gain.value = level
		gain.connect(master)
		return gain
	}
	return {
		ctx,
		master,
		ambient: bus(0),
		cues: bus(CUES_LEVEL),
		recordings: bus(RECORDINGS_LEVEL),
	}
}

/**
 * Creates or resumes the context. Call it from a click or key handler (a user
 * gesture), before anything should be heard; elsewhere browsers keep it
 * suspended. Returns null where Web Audio is missing.
 */
export function unlockAudio(): SoundEngine | null {
	if (engine === null) {
		const Ctor = contextCtor()
		if (Ctor === null) return null
		try {
			engine = build(new Ctor())
		} catch {
			return null
		}
	}
	if (engine.ctx.state === "suspended") void engine.ctx.resume().catch(noop)
	return engine
}

/** Stops the audio thread (sound off, tab hidden); `unlockAudio` resumes it. */
export function suspendAudio(): void {
	if (engine !== null && engine.ctx.state === "running") {
		void engine.ctx.suspend().catch(noop)
	}
}

/** Glides an AudioParam to `value` with time constant `tau` seconds (no clicks). */
export function glide(
	param: AudioParam,
	value: number,
	ctx: BaseAudioContext,
	tau: number,
): void {
	const now = ctx.currentTime
	param.cancelScheduledValues(now)
	param.setValueAtTime(param.value, now)
	param.setTargetAtTime(value, now, Math.max(0.001, tau))
}

function noop(): void {}

/** Test hook: forget the engine. */
export function resetEngineForTests(): void {
	engine = null
}
