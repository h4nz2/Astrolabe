import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HOME_SHOT, OVERVIEW } from "@/store/navigation"
import { useScaleStore } from "@/store/scale"
import { useSimStore } from "@/store/sim"

import {
	INTRO_SEEN_KEY,
	RESTORE_SCALE_MS,
	endIntro,
	hasSeenIntro,
	shouldPlayOnArrival,
	showHints,
	skipIntro,
	startIntro,
	useIntroStore,
	watchIntro,
} from "./intro"
import { SCALE_BEAT, SCALE_REVEAL_MS } from "./script"

const sim = () => useSimStore.getState()
const scale = () => useScaleStore.getState()
const intro = () => useIntroStore.getState()

let storage: Map<string, string>
let reduced = false
let unwatch: () => void = () => undefined

beforeEach(() => {
	storage = new Map()
	reduced = false
	vi.stubGlobal("window", {
		localStorage: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
		},
		matchMedia: (query: string) => ({
			matches: reduced && query.includes("reduced-motion"),
		}),
	})
	unwatch = watchIntro()
})

afterEach(() => {
	unwatch()
	vi.unstubAllGlobals()
	useSimStore.setState(useSimStore.getInitialState(), true)
	useScaleStore.setState(useScaleStore.getInitialState(), true)
	useIntroStore.setState(useIntroStore.getInitialState(), true)
})

/** What the camera rig does: the running transition arrives at `now`. */
const arrive = (now: number) => {
	const { transition, settle } = sim()
	if (transition !== null) settle(transition.id, now)
}

/** Plays the sequence like the rig would, arriving at once and holding each stop exactly. */
const playThrough = (untilIndex: number, now = 1000): number => {
	let t = now
	while (sim().sequence !== null && sim().sequence!.index < untilIndex) {
		arrive(t)
		t = sim().sequence?.holdUntil ?? t
		sim().tickSequence(t)
	}
	return t
}

describe("arrival", () => {
	it("plays only for a first visit on a link that does not say where to look", () => {
		expect(shouldPlayOnArrival({})).toBe(true)
		expect(shouldPlayOnArrival({ focus: "jupiter" })).toBe(false)
		expect(shouldPlayOnArrival({ scale: "trueScale" })).toBe(false)
		storage.set(INTRO_SEEN_KEY, "1")
		expect(shouldPlayOnArrival({})).toBe(false)
	})

	it("works without storage (private windows): it plays, and nothing throws", () => {
		vi.stubGlobal("window", {
			get localStorage(): Storage {
				throw new Error("blocked")
			},
			matchMedia: () => ({ matches: false }),
		})
		expect(hasSeenIntro()).toBe(false)
		expect(() => startIntro()).not.toThrow()
		expect(intro().status).toBe("playing")
	})
})

describe("the opening", () => {
	it("starts close on Earth in true scale and remembers it was shown here", () => {
		sim().select("mars")
		startIntro()
		expect(intro().status).toBe("playing")
		expect(sim().sequence?.steps).toBe(intro().steps)
		expect(sim().view).toEqual({ kind: "body", id: "earth" })
		expect(sim().transition?.durationMs).toBe(0)
		// a replay starts from a known state
		expect(sim().selectedId).toBeNull()
		expect(scale().presetId).toBe("trueScale")
		expect(storage.get(INTRO_SEEN_KEY)).toBe("1")
	})

	it("follows the beats and switches to Everything visible in the last one", () => {
		startIntro()
		playThrough(2)
		expect(intro().beat).toBe(2)
		expect(scale().targetId).toBe("trueScale")
		const at = playThrough(SCALE_BEAT)
		expect(intro().beat).toBe(SCALE_BEAT)
		expect(scale().targetId).toBe("everythingVisible")
		expect(scale().transition?.durationMs).toBe(SCALE_REVEAL_MS)
		expect(scale().transition?.startMs).toBeLessThanOrEqual(at + 1e6)
	})

	it("hands over on the overview, in the default scale, with the hints and Earth pulsing", () => {
		startIntro()
		const at = playThrough(SCALE_BEAT)
		scale().stepTransition(at + SCALE_REVEAL_MS)
		arrive(at)
		sim().tickSequence(sim().sequence!.holdUntil!)
		expect(sim().sequence).toBeNull()
		expect(intro().status).toBe("handover")
		expect(intro().ended).toBe("done")
		expect(intro().hints).toBe(true)
		expect(intro().pulse).toBe(true)
		expect(sim().view).toEqual(OVERVIEW)
		expect(sim().transition?.shot ?? HOME_SHOT).toEqual(HOME_SHOT)
		expect(scale().presetId).toBe("everythingVisible")
	})

	it("stops pulsing once the viewer picks a body", () => {
		startIntro()
		skipIntro()
		expect(intro().pulse).toBe(true)
		sim().setFocus("saturn")
		expect(intro().pulse).toBe(false)
	})
})

describe("ending early", () => {
	it("Skip lands on the overview in the default scale at once", () => {
		startIntro()
		playThrough(1)
		skipIntro()
		expect(sim().sequence).toBeNull()
		expect(sim().view).toEqual(OVERVIEW)
		expect(sim().transition?.durationMs).toBe(0)
		expect(scale().presetId).toBe("everythingVisible")
		expect(scale().transition).toBeNull()
		expect(intro().status).toBe("handover")
		expect(intro().ended).toBe("stopped")
		expect(intro().pulse).toBe(true)
	})

	it("Escape (reset) ends it the same way", () => {
		startIntro()
		playThrough(2)
		sim().reset()
		expect(intro().status).toBe("handover")
		expect(scale().presetId).toBe("everythingVisible")
	})

	it("a drag hands the camera over and the planets grow back gently", () => {
		startIntro()
		playThrough(1)
		sim().userInput()
		expect(intro().status).toBe("handover")
		expect(intro().ended).toBe("interrupted")
		// the interrupted sequence is not left behind for a tour player to resume
		expect(sim().sequence).toBeNull()
		expect(scale().targetId).toBe("everythingVisible")
		expect(scale().transition?.durationMs).toBe(RESTORE_SCALE_MS)
		// a transition carried on in the user's hands: the pivot still arrives
		expect(sim().transition?.handedOver).toBe(true)
	})

	it("a click on a planet flies there, and Earth does not pulse", () => {
		startIntro()
		playThrough(3)
		sim().setFocus("jupiter")
		expect(intro().status).toBe("handover")
		expect(intro().ended).toBe("interrupted")
		expect(sim().view).toEqual({ kind: "body", id: "jupiter" })
		expect(intro().pulse).toBe(false)
	})

	it("keeps a scale the viewer picked mid-way", () => {
		startIntro()
		playThrough(2)
		scale().switchTo("textbook", 5000)
		expect(intro().status).toBe("handover")
		expect(intro().ended).toBe("userScale")
		expect(scale().targetId).toBe("textbook")
	})

	it("ending twice does nothing more", () => {
		startIntro()
		skipIntro()
		const state = intro()
		endIntro("interrupted")
		skipIntro()
		expect(intro()).toBe(state)
	})
})

describe("reduced motion", () => {
	it("cuts from shot to shot and switches the scale without animating", () => {
		reduced = true
		startIntro()
		expect(intro().reducedMotion).toBe(true)
		for (const step of intro().steps!) expect(step.durationMs).toBe(0)
		playThrough(SCALE_BEAT)
		expect(scale().presetId).toBe("everythingVisible")
		expect(scale().transition).toBeNull()
	})

	it("restores the scale at once after an interruption", () => {
		reduced = true
		startIntro()
		playThrough(1)
		sim().userInput()
		expect(scale().presetId).toBe("everythingVisible")
	})
})

describe("the Help menu", () => {
	it("shows the hints again without the opening", () => {
		showHints()
		expect(intro().status).toBe("handover")
		expect(intro().hints).toBe(true)
		expect(sim().sequence).toBeNull()
	})

	it("replays the opening from wherever the viewer is", () => {
		sim().setFocus("neptune")
		useScaleStore.getState().setPreset("textbook")
		startIntro()
		expect(intro().status).toBe("playing")
		expect(sim().view).toEqual({ kind: "body", id: "earth" })
		expect(scale().presetId).toBe("trueScale")
	})
})
