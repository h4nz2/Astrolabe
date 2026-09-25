/**
 * Every sound the app makes itself (#32), synthesized with Web Audio: no audio
 * files, nothing to download. Soft by construction: slow attacks, no square
 * waves, no noise bursts, levels well below the recordings.
 */
import { glide } from "./engine"
import { whooshShape, type AmbientMix } from "./mix"

let noiseCache: WeakMap<BaseAudioContext, AudioBuffer> | null = null

/** Two seconds of white noise, made once per context and looped. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
	noiseCache ??= new WeakMap()
	const cached = noiseCache.get(ctx)
	if (cached !== undefined) return cached
	const length = Math.floor(ctx.sampleRate * 2)
	const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
	const data = buffer.getChannelData(0)
	for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
	noiseCache.set(ctx, buffer)
	return buffer
}

function noise(ctx: BaseAudioContext): AudioBufferSourceNode {
	const source = ctx.createBufferSource()
	source.buffer = noiseBuffer(ctx)
	source.loop = true
	return source
}

/**
 * The ambient bed: a low drone (a quiet A major chord under a low-pass) and a
 * deep rumble for the warm side; a thin band of airy noise and two faint high
 * tones beating slowly for the cold side. `set(mix)` crossfades them as the
 * camera moves (`ambientMix`), slowly enough that nobody hears a change, only
 * a place.
 */
export class AmbientBed {
	private readonly warm: GainNode
	private readonly cold: GainNode
	private readonly level: GainNode
	private readonly warmFilter: BiquadFilterNode
	private readonly sources: AudioScheduledSourceNode[] = []

	constructor(
		private readonly ctx: BaseAudioContext,
		out: AudioNode,
	) {
		this.level = ctx.createGain()
		this.level.gain.value = 1
		this.level.connect(out)

		// warm: drone through a low-pass that opens near the Sun, plus rumble
		this.warm = ctx.createGain()
		this.warm.gain.value = 0
		this.warm.connect(this.level)
		this.warmFilter = ctx.createBiquadFilter()
		this.warmFilter.type = "lowpass"
		this.warmFilter.frequency.value = 500
		this.warmFilter.Q.value = 0.7
		const breath = ctx.createGain()
		breath.gain.value = 0.8
		breath.connect(this.warm)
		this.warmFilter.connect(breath)
		this.lfo(0.06, 0.2, breath.gain)
		const drone: [number, OscillatorType, number][] = [
			[55, "sine", 0.55],
			[110.3, "triangle", 0.18],
			[138.6, "sine", 0.1],
			[164.6, "sine", 0.1],
		]
		for (const [hz, type, gain] of drone) {
			const osc = ctx.createOscillator()
			osc.type = type
			osc.frequency.value = hz
			const g = ctx.createGain()
			g.gain.value = gain
			osc.connect(g).connect(this.warmFilter)
			this.sources.push(osc)
		}
		const rumble = noise(ctx)
		const rumbleFilter = ctx.createBiquadFilter()
		rumbleFilter.type = "lowpass"
		rumbleFilter.frequency.value = 140
		const rumbleGain = ctx.createGain()
		rumbleGain.gain.value = 0.35
		rumble.connect(rumbleFilter).connect(rumbleGain).connect(this.warm)
		this.sources.push(rumble)

		// cold: a narrow band of drifting air and two faint tones beating slowly
		this.cold = ctx.createGain()
		this.cold.gain.value = 0
		this.cold.connect(this.level)
		const air = noise(ctx)
		const airFilter = ctx.createBiquadFilter()
		airFilter.type = "bandpass"
		airFilter.frequency.value = 2200
		airFilter.Q.value = 5
		this.lfo(0.035, 700, airFilter.frequency)
		const airGain = ctx.createGain()
		airGain.gain.value = 0.22
		air.connect(airFilter).connect(airGain).connect(this.cold)
		this.sources.push(air)
		for (const hz of [987.8, 989.6]) {
			const osc = ctx.createOscillator()
			osc.type = "sine"
			osc.frequency.value = hz
			const g = ctx.createGain()
			g.gain.value = 0.012
			osc.connect(g).connect(this.cold)
			this.sources.push(osc)
		}
	}

	/** A slow sine wobble of `depth` around `param`'s value. */
	private lfo(hz: number, depth: number, param: AudioParam): void {
		const osc = this.ctx.createOscillator()
		osc.frequency.value = hz
		const g = this.ctx.createGain()
		g.gain.value = depth
		osc.connect(g).connect(param)
		this.sources.push(osc)
	}

	start(): void {
		for (const source of this.sources) source.start()
	}

	/** Crossfades to `mix` over about `seconds` (a first call sets it at once). */
	set(mix: AmbientMix, seconds = 1.5): void {
		const tau = seconds / 3
		glide(this.warm.gain, mix.warm, this.ctx, tau)
		glide(this.cold.gain, mix.cold, this.ctx, tau)
		glide(this.level.gain, mix.level, this.ctx, tau)
		glide(this.warmFilter.frequency, mix.cutoffHz, this.ctx, tau)
	}

	stop(): void {
		for (const source of this.sources) {
			try {
				source.stop()
			} catch {
				// never started
			}
		}
		this.level.disconnect()
	}
}

/** A playing whoosh, to cut short when the flight is skipped or replaced. */
export interface Voice {
	stop: () => void
}

/**
 * The flight's whoosh: air rushing past, band-passed noise that rises while
 * the camera pulls back, peaks and sweeps from left to right while the system
 * slides by beneath, and settles as it descends (`whooshShape`).
 */
export function whoosh(
	ctx: BaseAudioContext,
	out: AudioNode,
	durationMs: number,
	travelStart: number,
	travelEnd: number,
): Voice {
	const seconds = durationMs / 1000
	const t0 = ctx.currentTime + 0.02
	const source = noise(ctx)
	const filter = ctx.createBiquadFilter()
	filter.type = "bandpass"
	filter.Q.value = 1.1
	const gain = ctx.createGain()
	gain.gain.value = 0
	const pan = ctx.createStereoPanner()
	source.connect(filter).connect(gain).connect(pan).connect(out)
	const peak = 0.5
	for (const point of whooshShape(travelStart, travelEnd)) {
		const at = t0 + point.t * seconds
		if (point.t === 0) {
			filter.frequency.setValueAtTime(point.hz, at)
			gain.gain.setValueAtTime(0.0001, at)
		} else {
			filter.frequency.exponentialRampToValueAtTime(point.hz, at)
			gain.gain.exponentialRampToValueAtTime(
				Math.max(0.0001, point.gain * peak),
				at,
			)
		}
	}
	pan.pan.setValueAtTime(-0.5, t0 + travelStart * seconds)
	pan.pan.linearRampToValueAtTime(0.5, t0 + travelEnd * seconds)
	source.start(t0)
	source.stop(t0 + seconds + 0.1)
	let stopped = false
	return {
		stop: () => {
			if (stopped) return
			stopped = true
			const now = ctx.currentTime
			gain.gain.cancelScheduledValues(now)
			gain.gain.setValueAtTime(gain.gain.value, now)
			gain.gain.setTargetAtTime(0, now, 0.06)
			try {
				source.stop(now + 0.4)
			} catch {
				// already stopped
			}
		},
	}
}

/**
 * A soft bell at `hz`: a sine with a quiet third partial, a gentle attack and
 * a long fade. Arrivals, light reaching a body, finds.
 */
export function chime(
	ctx: BaseAudioContext,
	out: AudioNode,
	hz: number,
	{
		delay = 0,
		gain = 0.22,
		decay = 1.6,
	}: { delay?: number; gain?: number; decay?: number } = {},
): void {
	const t0 = ctx.currentTime + 0.01 + delay
	const env = ctx.createGain()
	env.gain.setValueAtTime(0.0001, t0)
	env.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
	env.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
	env.connect(out)
	const partials: [number, number][] = [
		[1, 1],
		[3.01, 0.12],
	]
	for (const [ratio, level] of partials) {
		const osc = ctx.createOscillator()
		osc.type = "sine"
		osc.frequency.value = hz * ratio
		const g = ctx.createGain()
		g.gain.value = level
		osc.connect(g).connect(env)
		osc.start(t0)
		osc.stop(t0 + decay + 0.05)
	}
}

/** Pause and play: a tiny, muted tick, lower for pause. */
export function tick(ctx: BaseAudioContext, out: AudioNode, up: boolean): void {
	chime(ctx, out, up ? 880 : 587.33, { gain: 0.08, decay: 0.12 })
}

/** Time travel starts: a soft glissando, rising into the future, falling into the past. */
export function sweep(
	ctx: BaseAudioContext,
	out: AudioNode,
	forward: boolean,
	durationMs: number,
): void {
	const seconds = Math.min(2, Math.max(0.5, durationMs / 1000))
	const t0 = ctx.currentTime + 0.01
	const [from, to] = forward ? [330, 990] : [990, 330]
	const osc = ctx.createOscillator()
	osc.type = "triangle"
	osc.frequency.setValueAtTime(from, t0)
	osc.frequency.exponentialRampToValueAtTime(to, t0 + seconds)
	const filter = ctx.createBiquadFilter()
	filter.type = "lowpass"
	filter.frequency.value = 1400
	const env = ctx.createGain()
	env.gain.setValueAtTime(0.0001, t0)
	env.gain.exponentialRampToValueAtTime(0.06, t0 + seconds * 0.3)
	env.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds)
	osc.connect(filter).connect(env).connect(out)
	osc.start(t0)
	osc.stop(t0 + seconds + 0.05)
}

/** A clue solved: two rising bells. */
export function found(ctx: BaseAudioContext, out: AudioNode): void {
	chime(ctx, out, 659.25, { gain: 0.2 })
	chime(ctx, out, 987.77, { gain: 0.2, delay: 0.14 })
}

/** A hunt finished: a gentle arpeggio up the major chord. */
export function finished(ctx: BaseAudioContext, out: AudioNode): void {
	const notes = [523.25, 659.25, 783.99, 1046.5]
	notes.forEach((hz, index) =>
		chime(ctx, out, hz, { gain: 0.18, delay: index * 0.13, decay: 2.2 }),
	)
}
