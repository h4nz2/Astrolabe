/**
 * Earth's "click me" pulse after the opening (#30): the ring element lives in
 * the HUD (`IntroPulse.tsx`) and `IntroPulseTracker.tsx` places it over Earth
 * every frame, straight on the DOM, like the hover ring (scene/highlight.ts).
 * Module state because the page has exactly one scene.
 */
export const pulseSlot: { element: HTMLElement | null } = { element: null }

/** The body that pulses: "you are here", and where the opening began. */
export const PULSE_BODY_ID = "earth"

/** Longest the pulse runs when nobody clicks anything, ms. */
export const PULSE_MS = 45_000
