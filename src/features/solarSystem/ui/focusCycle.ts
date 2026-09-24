import { bodyById, childrenOf, planets, sun } from "@/data"

/**
 * The bodies the Left/Right arrows cycle through from `id`, in orbital order:
 * the moons of the same planet for a moon, otherwise the Sun and the planets
 * (so the arrows are never dead keys on the Sun). Empty for an unknown id.
 */
export function focusRing(id: string): string[] {
	const body = bodyById.get(id)
	if (body === undefined) return []
	if (body.kind === "moon" && body.parentId !== null) {
		return childrenOf(body.parentId).map((sibling) => sibling.id)
	}
	return [sun.id, ...planets.map((planet) => planet.id)]
}

/** The neighbour of `id` in its ring, wrapping around; `id` itself when it has none. */
export function cycleFocus(id: string, direction: 1 | -1): string {
	const ring = focusRing(id)
	const at = ring.indexOf(id)
	if (at === -1 || ring.length < 2) return id
	return ring[(at + direction + ring.length) % ring.length]
}
