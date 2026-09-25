/**
 * When a hint opens and closes (#39), apart from the DOM: mouse hover after a
 * short delay, keyboard focus, and a long press on touch screens, where a
 * plain tap must still just toggle. `Hint.tsx` feeds it DOM events; the unit
 * tests feed it the same calls with fake timers.
 */

/** Hovering this long opens a hint, so hints do not flicker while the pointer passes by. */
export const HOVER_DELAY_MS = 500
/** Keyboard focus opens a hint sooner, but tabbing straight past a control shows nothing. */
export const FOCUS_DELAY_MS = 250
/** Pressing a finger this long shows the hint instead of toggling (the platform's long press). */
export const LONG_PRESS_MS = 500
/** A finger that moves farther than this is scrolling or dragging, not pressing. */
export const LONG_PRESS_SLOP_PX = 10
/** Leaving a control closes its hint after this grace, so the pointer can move onto the hint. */
export const CLOSE_DELAY_MS = 120
/** Within this long of another hint closing, the next one opens at once (moving along a row of switches). */
export const WARM_MS = 400
/** The click that follows a long press is swallowed for this long after the finger lifts. */
const SWALLOW_CLICK_MS = 700
/** Focus arriving this soon after a press came from the pointer, not the keyboard (a text field is always :focus-visible). */
const PRESS_FOCUS_MS = 1000

export type HintTrigger = "hover" | "focus" | "touch"

export interface HintState<A> {
	/** Which hint of the zone: "" for a zone with one text, else the option's key. */
	readonly key: string
	readonly anchor: A
	readonly via: HintTrigger
}

type Clock = () => number

/** One hint open in the whole page; the last one to close warms the next. */
const shared = {
	open: null as HintController<unknown> | null,
	closedAt: Number.NEGATIVE_INFINITY,
}

/** Only for tests: forget the page-wide state. */
export function resetHintsForTests(): void {
	shared.open = null
	shared.closedAt = Number.NEGATIVE_INFINITY
}

export class HintController<A> {
	private state: HintState<A> | null = null
	private timer: ReturnType<typeof setTimeout> | null = null
	private press: { x: number; y: number; fired: boolean } | null = null
	private swallowUntil = Number.NEGATIVE_INFINITY
	/** Pressing a control with the mouse hides its hint until the pointer leaves. */
	private pressed = false
	private lastPressAt = Number.NEGATIVE_INFINITY
	private readonly onChange: (state: HintState<A> | null) => void
	private readonly now: Clock

	constructor(
		onChange: (state: HintState<A> | null) => void,
		now: Clock = () => performance.now(),
	) {
		this.onChange = onChange
		this.now = now
	}

	get current(): HintState<A> | null {
		return this.state
	}

	/** The mouse (or a pen) is over the option `key`. */
	hoverStart(key: string, anchor: A): void {
		if (this.pressed) return
		if (this.state?.via === "touch") return
		if (this.state !== null && this.state.key === key) {
			this.clearTimer()
			return
		}
		this.schedule({ key, anchor, via: "hover" }, HOVER_DELAY_MS)
	}

	/** The pointer left the zone and is not on the hint either. */
	hoverEnd(): void {
		this.pressed = false
		if (this.state?.via === "focus" || this.state?.via === "touch") return
		this.clearTimer()
		if (this.state !== null)
			this.timer = setTimeout(() => this.close(), CLOSE_DELAY_MS)
	}

	/** The pointer moved onto the open hint itself: keep it (WCAG 1.4.13, hoverable). */
	hintHovered(): void {
		if (this.state !== null) this.clearTimer()
	}

	/** Keyboard focus reached the option `key`; `visible` is `:focus-visible` (not a mouse click). */
	focusIn(key: string, anchor: A, visible: boolean): void {
		if (!visible || this.now() - this.lastPressAt < PRESS_FOCUS_MS) return
		this.schedule({ key, anchor, via: "focus" }, FOCUS_DELAY_MS)
	}

	focusOut(): void {
		if (this.state?.via === "touch") return
		this.clearTimer()
		if (this.state?.via === "focus") this.close()
	}

	/** A pointer went down on the option `key`. */
	pressStart(
		pointerType: string,
		x: number,
		y: number,
		key: string,
		anchor: A,
	): void {
		this.lastPressAt = this.now()
		if (pointerType !== "touch") {
			// a click hides the hint, like a native tooltip
			this.pressed = true
			this.clearTimer()
			this.close()
			return
		}
		this.close()
		this.press = { x, y, fired: false }
		this.clearTimer()
		this.timer = setTimeout(() => {
			if (this.press === null) return
			this.press.fired = true
			this.swallowUntil = Number.POSITIVE_INFINITY
			this.open({ key, anchor, via: "touch" })
		}, LONG_PRESS_MS)
	}

	pressMove(x: number, y: number): void {
		if (this.press === null || this.press.fired) return
		if (Math.hypot(x - this.press.x, y - this.press.y) > LONG_PRESS_SLOP_PX)
			this.cancelPress()
	}

	/** The finger lifted (or the browser took the gesture over). */
	pressEnd(): void {
		this.lastPressAt = this.now()
		if (this.press?.fired) this.swallowUntil = this.now() + SWALLOW_CLICK_MS
		else this.cancelPress()
		this.press = null
	}

	/**
	 * Whether the click now arriving is the tail of a long press and must not
	 * toggle the control. Answers true at most once per long press.
	 */
	takeClick(): boolean {
		const swallow = this.now() <= this.swallowUntil
		this.swallowUntil = Number.NEGATIVE_INFINITY
		return swallow
	}

	/** Escape, a touch anywhere else, scrolling: close without waiting. */
	dismiss(): void {
		this.clearTimer()
		this.cancelPress()
		this.close()
	}

	dispose(): void {
		this.clearTimer()
		if (shared.open === this) shared.open = null
		this.state = null
	}

	private schedule(next: HintState<A>, delay: number): void {
		this.clearTimer()
		const warm =
			(shared.open !== null && shared.open !== this) ||
			this.state !== null ||
			this.now() - shared.closedAt < WARM_MS
		if (warm) {
			this.open(next)
			return
		}
		this.timer = setTimeout(() => this.open(next), delay)
	}

	private open(next: HintState<A>): void {
		this.timer = null
		if (shared.open !== null && shared.open !== this) shared.open.dismiss()
		shared.open = this as HintController<unknown>
		this.state = next
		this.onChange(next)
	}

	private close(): void {
		this.timer = null
		if (this.state === null) return
		this.state = null
		if (shared.open === this) {
			shared.open = null
			shared.closedAt = this.now()
		}
		this.onChange(null)
	}

	private cancelPress(): void {
		if (this.press !== null && !this.press.fired) this.clearTimer()
		this.press = null
	}

	private clearTimer(): void {
		if (this.timer !== null) clearTimeout(this.timer)
		this.timer = null
	}
}
