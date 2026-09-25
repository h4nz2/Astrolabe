/**
 * The moon maps (#37) are aligned to the IAU frame: longitude 0 at the texture's centre, east to
 * the right. For a tidally locked moon that means the sub-planet point is longitude 0 and the
 * leading hemisphere (the side facing its direction of travel) is centred on 90 deg W, u = 0.25.
 * That is where the maps put Iapetus's dark Cassini Regio and Mimas's Herschel crater, and where
 * Dione's and Tethys's darker trailing sides are not.
 */
import { describe, expect, it } from "vitest"
import { Vector3 } from "three"

import { bodies, getBody } from "@/data"
import { buildIndex, computePositions, dateToJD } from "@/sim"

import {
	bodyOrientation,
	bodySpinAngle,
	bodySurfaceOrientation,
	createBodySpin,
} from "./orientation"

const index = buildIndex(bodies)
const RAD = 180 / Math.PI

/** East longitude (deg) of the surface point facing the moon's direction of travel around its planet. */
const leadingLongitude = (id: string, date: string): number => {
	const jd = dateToJD(new Date(date))
	const dt = 1 / 1440
	const now = computePositions(bodies, jd, undefined, index)
	const later = computePositions(bodies, jd + dt, undefined, index)
	const body = getBody(id)
	const i = index.get(id) ?? -1
	const p = index.get(body.parentId ?? "") ?? -1
	// velocity relative to the planet
	const velocity = new Vector3(
		later[i * 3] - later[p * 3] - (now[i * 3] - now[p * 3]),
		later[i * 3 + 1] - later[p * 3 + 1] - (now[i * 3 + 1] - now[p * 3 + 1]),
		later[i * 3 + 2] - later[p * 3 + 2] - (now[i * 3 + 2] - now[p * 3 + 2]),
	).normalize()
	const frame = { index, positionsKm: now, spinJD: jd }
	const angle = bodySpinAngle(body, createBodySpin(body, i, frame), frame)
	const surface = bodySurfaceOrientation(bodyOrientation(body), angle)
	const local = velocity.applyQuaternion(surface.invert())
	// SphereGeometry: longitude 0 at +X, east at -Z (orientation.ts)
	return Math.atan2(-local.z, local.x) * RAD
}

describe("moon maps in the IAU frame", () => {
	for (const id of [
		"moon",
		"io",
		"europa",
		"mimas",
		"dione",
		"iapetus",
		"ariel",
		"titania",
	]) {
		it(`puts ${id}'s leading hemisphere at 90 deg W, where its map has it`, () => {
			for (const date of ["2025-01-01T00:00:00Z", "2026-09-25T12:00:00Z"]) {
				// an eccentric or inclined orbit tilts the velocity off the exact apex a little
				expect(Math.abs(leadingLongitude(id, date) + 90)).toBeLessThan(8)
			}
		})
	}

	it("keeps Triton's leading side at 90 deg W although it orbits backwards", () => {
		// Triton is locked and retrograde: it still leads with the hemisphere at 90 W of its own
		// (IAU) frame, because its prime meridian faces Neptune and it spins backwards too
		expect(
			Math.abs(leadingLongitude("triton", "2025-01-01T00:00:00Z") + 90),
		).toBeLessThan(8)
	})
})
