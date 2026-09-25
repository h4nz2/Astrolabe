import {
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from "react"
import { createPortal } from "react-dom"

import { HintController, type HintState } from "./controller"
import { placeHint, unionBox, type Box } from "./placement"

import classes from "./Hint.module.css"

export interface HintProps {
	/** One hint for the whole control: what it does and why you would want it, one sentence. */
	text?: string
	/**
	 * Only while the control is disabled: why, and what to do ("Turn on Moons
	 * first."). Shown under the text.
	 */
	reason?: string
	/**
	 * One hint per option instead: keyed by radio value (SegmentedControl,
	 * Radio.Group, Chip.Group) or by a `data-hint-key` attribute on a part
	 * (see `hintKey`), e.g. each button of an ActionIcon.Group.
	 */
	options?: Readonly<Record<string, string>>
	children: ReactNode
}

/** Marks a part of a `<Hint options>` zone: `<ActionIcon {...hintKey("pause")} />`. */
export const hintKey = (key: string) => ({ "data-hint-key": key })

/** Everything a hint can describe: whatever takes keyboard focus. */
const FOCUSABLE =
	'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])'

/** The part of the zone's control that `key` belongs to, or null for the whole zone. */
type Anchor = Element | null

interface Found {
	key: string
	anchor: Anchor
}

/** Which hint of the zone an event target belongs to. */
function resolve(
	zone: HTMLElement,
	target: EventTarget | null,
	options: Readonly<Record<string, string>> | undefined,
): Found | null {
	if (!(target instanceof Element) || !zone.contains(target)) return null
	if (options === undefined) return { key: "", anchor: null }
	const marker = target.closest<HTMLElement>("[data-hint-key]")
	const markerKey = marker?.dataset.hintKey
	if (marker && markerKey !== undefined && zone.contains(marker))
		return markerKey in options ? { key: markerKey, anchor: marker } : null
	const input =
		target instanceof HTMLInputElement
			? target
			: target.closest("label")?.control
	if (
		input instanceof HTMLInputElement &&
		input.type === "radio" &&
		zone.contains(input) &&
		input.value in options
	)
		return { key: input.value, anchor: input.labels?.[0] ?? input }
	return null
}

/** The control(s) a hint describes: the focusable element itself or the input its label is for. */
function describedElements(
	zone: HTMLElement,
	options: Readonly<Record<string, string>> | undefined,
): [Element, string][] {
	if (options === undefined)
		return [...zone.querySelectorAll(FOCUSABLE)].map((el) => [el, ""])
	const found: [Element, string][] = []
	for (const input of zone.querySelectorAll<HTMLInputElement>(
		'input[type="radio"]',
	)) {
		if (input.value in options) found.push([input, input.value])
	}
	for (const marker of zone.querySelectorAll<HTMLElement>("[data-hint-key]")) {
		const key = marker.dataset.hintKey ?? ""
		if (!(key in options)) continue
		const target = marker.matches(FOCUSABLE)
			? marker
			: (marker.closest("label")?.control ?? marker.querySelector(FOCUSABLE))
		if (target) found.push([target, key])
	}
	return found
}

/** Adds `id` to the element's aria-describedby, keeping what is there (a Switch's description). */
function addDescription(el: Element, id: string): void {
	const ids = (el.getAttribute("aria-describedby") ?? "")
		.split(/\s+/)
		.filter(Boolean)
	if (!ids.includes(id))
		el.setAttribute("aria-describedby", [...ids, id].join(" "))
}

function isFocusVisible(el: EventTarget | null): boolean {
	if (!(el instanceof Element)) return false
	try {
		return el.matches(":focus-visible")
	} catch {
		return true
	}
}

function anchorBox(zone: HTMLElement, anchor: Anchor): Box | null {
	if (anchor !== null) return anchor.getBoundingClientRect()
	return unionBox([...zone.children].map((el) => el.getBoundingClientRect()))
}

const optionIndex = (
	options: Readonly<Record<string, string>> | undefined,
	key: string,
) => (options === undefined ? -1 : Object.keys(options).indexOf(key))

/**
 * A hover hint (#39) for a control, or one per option of a control: shown
 * after a short hover, on keyboard focus, and on a long press on touch
 * screens (a plain tap still toggles); beside the control, never on top of it;
 * the control's accessible description at all times. Wraps without adding a
 * box (`display: contents`), so layouts and group styles stay as they were.
 *
 *     <Hint text={t("…hint.orbits")}><Switch … /></Hint>
 *     <Hint text={t("…hint.allMoons")} reason={showMoons ? undefined : t("…reason.allMoons")}>…</Hint>
 *     <Hint options={{ trueScale: t(…), textbook: t(…) }}><SegmentedControl … /></Hint>
 */
export default function Hint({ text, reason, options, children }: HintProps) {
	const baseId = useId()
	const [zone, setZone] = useState<HTMLSpanElement | null>(null)
	const [popups] = useState(() => new Map<string, HTMLDivElement>())
	const optionsRef = useRef(options)
	const [state, setState] = useState<HintState<Anchor> | null>(null)
	const [controller] = useState(() => new HintController<Anchor>(setState))

	const idFor = (key: string) =>
		options === undefined
			? `${baseId}hint`
			: `${baseId}hint-${optionIndex(options, key)}`

	useLayoutEffect(() => {
		optionsRef.current = options
	})

	// the description, on the control itself, whether or not the hint shows
	useEffect(() => {
		if (zone === null || (text === undefined && options === undefined)) return
		for (const [el, key] of describedElements(zone, options))
			addDescription(el, idFor(key))
	})

	useEffect(() => {
		if (zone === null) return
		let lastPointer = "mouse"
		const find = (target: EventTarget | null) =>
			resolve(zone, target, optionsRef.current)
		const inPopup = (target: EventTarget | null) =>
			target instanceof Node &&
			[...popups.values()].some((popup) => popup.contains(target))

		const over = (event: PointerEvent) => {
			if (event.pointerType === "touch") return
			const found = find(event.target)
			if (found) controller.hoverStart(found.key, found.anchor)
		}
		const out = (event: PointerEvent) => {
			if (event.pointerType === "touch") return
			const to = event.relatedTarget
			if (to instanceof Node && (zone.contains(to) || inPopup(to))) return
			controller.hoverEnd()
		}
		const down = (event: PointerEvent) => {
			lastPointer = event.pointerType
			const found = find(event.target)
			if (found === null && event.pointerType === "touch") return
			controller.pressStart(
				event.pointerType,
				event.clientX,
				event.clientY,
				found?.key ?? "",
				found?.anchor ?? null,
			)
		}
		const move = (event: PointerEvent) => {
			if (event.pointerType === "touch")
				controller.pressMove(event.clientX, event.clientY)
		}
		const up = () => controller.pressEnd()
		// the click that ends a long press must not toggle: stopped before React sees it
		const click = (event: MouseEvent) => {
			if (!controller.takeClick()) return
			event.preventDefault()
			event.stopPropagation()
		}
		const menu = (event: Event) => {
			if (lastPointer === "touch") event.preventDefault()
		}
		const focusIn = (event: FocusEvent) => {
			const found = find(event.target)
			if (found)
				controller.focusIn(
					found.key,
					found.anchor,
					isFocusVisible(event.target),
				)
		}
		const focusOut = (event: FocusEvent) => {
			const next = find(event.relatedTarget)
			if (next !== null && next.key === controller.current?.key) return
			controller.focusOut()
		}

		zone.addEventListener("pointerover", over)
		zone.addEventListener("pointerout", out)
		zone.addEventListener("pointerdown", down)
		zone.addEventListener("pointermove", move)
		zone.addEventListener("pointerup", up)
		zone.addEventListener("pointercancel", up)
		zone.addEventListener("click", click, true)
		zone.addEventListener("contextmenu", menu)
		zone.addEventListener("focusin", focusIn)
		zone.addEventListener("focusout", focusOut)
		return () => {
			zone.removeEventListener("pointerover", over)
			zone.removeEventListener("pointerout", out)
			zone.removeEventListener("pointerdown", down)
			zone.removeEventListener("pointermove", move)
			zone.removeEventListener("pointerup", up)
			zone.removeEventListener("pointercancel", up)
			zone.removeEventListener("click", click, true)
			zone.removeEventListener("contextmenu", menu)
			zone.removeEventListener("focusin", focusIn)
			zone.removeEventListener("focusout", focusOut)
			controller.dispose()
		}
	}, [zone, popups, controller])

	// while a hint shows: Escape, a touch elsewhere, scrolling or resizing close it
	useEffect(() => {
		if (state === null) return
		const key = (event: KeyboardEvent) => {
			if (event.key === "Escape") controller.dismiss()
		}
		const down = (event: PointerEvent) => {
			const target = event.target
			if (target instanceof Node && zone?.contains(target)) return
			if (
				target instanceof Node &&
				[...popups.values()].some((p) => p.contains(target))
			)
				return
			controller.dismiss()
		}
		const away = () => controller.dismiss()
		document.addEventListener("keydown", key)
		document.addEventListener("pointerdown", down, true)
		window.addEventListener("scroll", away, true)
		window.addEventListener("resize", away)
		return () => {
			document.removeEventListener("keydown", key)
			document.removeEventListener("pointerdown", down, true)
			window.removeEventListener("scroll", away, true)
			window.removeEventListener("resize", away)
		}
	}, [state, zone, popups, controller])

	// beside the control, measured before paint
	useLayoutEffect(() => {
		if (state === null || zone === null) return
		const popup = popups.get(state.key)
		const anchor = anchorBox(zone, state.anchor)
		if (popup === undefined || anchor === null) return
		const placed = placeHint(
			anchor,
			{ width: popup.offsetWidth, height: popup.offsetHeight },
			{
				width: document.documentElement.clientWidth,
				height: document.documentElement.clientHeight,
			},
		)
		popup.style.top = `${placed.top}px`
		popup.style.left = `${placed.left}px`
		popup.dataset.side = placed.side
	}, [state, zone, popups])

	const hints: [string, string, string | undefined][] =
		options !== undefined
			? Object.entries(options).map(([key, value]) => [key, value, undefined])
			: text !== undefined
				? [["", text, reason]]
				: []

	return (
		<>
			<span ref={setZone} className={classes.zone}>
				{children}
			</span>
			{hints.length > 0 &&
				typeof document !== "undefined" &&
				createPortal(
					hints.map(([key, body, why]) => (
						<div
							key={key}
							id={idFor(key)}
							ref={(el) => {
								if (el) popups.set(key, el)
								else popups.delete(key)
							}}
							role="tooltip"
							className={classes.hint}
							hidden={state?.key !== key}
							onPointerEnter={() => controller.hintHovered()}
							onPointerLeave={(event) => {
								const to = event.relatedTarget
								if (to instanceof Node && zone?.contains(to)) return
								controller.hoverEnd()
							}}
						>
							{body}
							{why !== undefined && (
								<>
									{" "}
									<span className={classes.reason}>{why}</span>
								</>
							)}
						</div>
					)),
					document.body,
				)}
		</>
	)
}
