import { afterEach, describe, expect, it } from "vitest"
import { create } from "zustand"

import { useBirthdayStore } from "@/store/birthday"
import { useHudStore } from "@/store/hud"
import { useHuntStore } from "@/store/hunt"
import { useLightStore } from "@/store/light"
import { useSkyTonightStore } from "@/store/skyTonight"

import { keepDockToOnePanel, keepOneOpen, type DockEntry } from "./exclusive"

const fakeTool = (id: string) => {
	const store = create<{ open: boolean; setOpen: (open: boolean) => void }>()(
		(set) => ({ open: false, setOpen: (open) => set({ open }) }),
	)
	const entry: DockEntry = {
		id,
		isOpen: () => store.getState().open,
		close: () => store.getState().setOpen(false),
		subscribe: (listener) => store.subscribe(listener),
	}
	return { store, entry }
}

describe("keepOneOpen", () => {
	it("closes the open panel when another one opens", () => {
		const a = fakeTool("a")
		const b = fakeTool("b")
		const c = fakeTool("c")
		const stop = keepOneOpen([a.entry, b.entry, c.entry])
		a.store.getState().setOpen(true)
		expect([a, b, c].map((t) => t.store.getState().open)).toEqual([
			true,
			false,
			false,
		])
		b.store.getState().setOpen(true)
		expect([a, b, c].map((t) => t.store.getState().open)).toEqual([
			false,
			true,
			false,
		])
		c.store.getState().setOpen(true)
		expect([a, b, c].map((t) => t.store.getState().open)).toEqual([
			false,
			false,
			true,
		])
		// closing leaves the others closed; reopening the first works again
		c.store.getState().setOpen(false)
		a.store.getState().setOpen(true)
		expect([a, b, c].map((t) => t.store.getState().open)).toEqual([
			true,
			false,
			false,
		])
		stop()
		b.store.getState().setOpen(true)
		expect(a.store.getState().open).toBe(true)
	})
})

describe("the solar system's dock", () => {
	let stop = () => {}
	afterEach(() => {
		stop()
		useHudStore.getState().setPanel(null)
		useLightStore.getState().setOpen(false)
		useBirthdayStore.getState().setOpen(false)
		useSkyTonightStore.getState().setOpen(false)
		useHuntStore.getState().setOpen(false)
	})

	it("holds one of Layers, Scale, spacecraft, light, birthday, sky and hunt", () => {
		stop = keepDockToOnePanel()
		useHudStore.getState().setPanel("layers")
		useLightStore.getState().setOpen(true)
		expect(useHudStore.getState().panel).toBeNull()
		useHudStore.getState().setPanel("scale")
		expect(useLightStore.getState().open).toBe(false)
		useBirthdayStore.getState().setOpen(true)
		expect(useHudStore.getState().panel).toBeNull()
		useSkyTonightStore.getState().setOpen(true)
		expect(useBirthdayStore.getState().open).toBe(false)
		useHuntStore.getState().setOpen(true)
		expect(useSkyTonightStore.getState().open).toBe(false)
		useHudStore.getState().setPanel("spacecraft")
		expect(useHuntStore.getState().open).toBe(false)
		// switching between the HUD's own panels keeps the new one
		useHudStore.getState().togglePanel("layers")
		expect(useHudStore.getState().panel).toBe("layers")
		useHudStore.getState().togglePanel("layers")
		expect(useHudStore.getState().panel).toBeNull()
	})
})
