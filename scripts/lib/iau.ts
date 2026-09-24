/**
 * Body orientation constants from the IAU Working Group on Cartographic Coordinates and
 * Rotational Elements, 2015 report (Archinal et al., Celest. Mech. Dyn. Astron. 130:22, 2018).
 *
 * The series are evaluated at J2000 and frozen: the secular drift of the poles is below
 * 0.7 deg per century. For most planets that is the constant term; Mars (a 1.6 deg term of a
 * 71,000-year period) and Neptune (0.7 deg, 690 years) keep their periodic terms. For the Moon the
 * periodic terms (E1..E13, up to 3.9 deg) matter: at J2000 they put the pole 1.57 deg from the
 * ecliptic pole and 6.7 deg from the normal of the Moon's J2000 mean orbit (its Cassini state),
 * which is consistent with the frozen J2000 node that bodies.json uses for the Moon.
 *
 * `poleRaDeg` / `poleDecDeg` locate the IAU north pole in the ICRF (J2000 equatorial) frame.
 * `primeMeridianDeg` is W0: the angle at J2000 from the ascending node of the body's equator on
 * the ICRF equator to the prime meridian, measured eastward (right handed about the north pole).
 * `rotationRateDegPerDay` is W1; the build derives the sidereal period from it, because the
 * source's rounded periods (Earth 23.9345 h) turn the prime meridian several degrees away
 * from the IAU one within a few decades of J2000 (Earth: 4 deg, 16 minutes of local time, by
 * 2026). Negative = retrograde (Venus, Uranus), the same sign convention as `periodHours`.
 */
export interface IauOrientation {
	readonly poleRaDeg: number
	readonly poleDecDeg: number
	readonly primeMeridianDeg: number
	readonly rotationRateDegPerDay: number
}

export const IAU_ORIENTATIONS: Readonly<
	Partial<Record<string, IauOrientation>>
> = {
	sun: {
		poleRaDeg: 286.13,
		poleDecDeg: 63.87,
		primeMeridianDeg: 84.176,
		rotationRateDegPerDay: 14.1844,
	},
	mercury: {
		poleRaDeg: 281.0103,
		poleDecDeg: 61.4155,
		primeMeridianDeg: 329.5988,
		rotationRateDegPerDay: 6.1385108,
	},
	venus: {
		poleRaDeg: 272.76,
		poleDecDeg: 67.16,
		primeMeridianDeg: 160.2,
		rotationRateDegPerDay: -1.4813688,
	},
	earth: {
		poleRaDeg: 0,
		poleDecDeg: 90,
		primeMeridianDeg: 190.147,
		rotationRateDegPerDay: 360.9856235,
	},
	mars: {
		// with the 0.42 / 1.59 / 0.58 deg long-period terms at J2000 (constant terms alone:
		// 317.269202, 54.432516, 176.049863, which put the pole 1.5 deg off and the tilt at 23.9)
		poleRaDeg: 317.681106,
		poleDecDeg: 52.886346,
		primeMeridianDeg: 176.631819,
		rotationRateDegPerDay: 350.891982443297,
	},
	jupiter: {
		poleRaDeg: 268.056595,
		poleDecDeg: 64.495303,
		primeMeridianDeg: 284.95,
		rotationRateDegPerDay: 870.536,
	},
	saturn: {
		poleRaDeg: 40.589,
		poleDecDeg: 83.537,
		primeMeridianDeg: 38.9,
		rotationRateDegPerDay: 810.7939024,
	},
	uranus: {
		poleRaDeg: 257.311,
		poleDecDeg: -15.175,
		primeMeridianDeg: 203.81,
		rotationRateDegPerDay: -501.1600928,
	},
	// N = 357.85 deg at J2000: 0.70 sin N, -0.51 cos N, -0.48 sin N (constant terms alone:
	// 299.36, 43.46, 249.978, which make the tilt 27.8 instead of 28.3)
	neptune: {
		poleRaDeg: 299.333739,
		poleDecDeg: 42.950359,
		primeMeridianDeg: 249.996008,
		rotationRateDegPerDay: 541.1397757,
	},
	// full series at J2000 (constant terms alone: 269.9949, 66.5392, 38.3213)
	moon: {
		poleRaDeg: 266.8577,
		poleDecDeg: 65.6411,
		primeMeridianDeg: 41.1953,
		rotationRateDegPerDay: 13.17635815,
	},
}

export interface Oblateness {
	/** gravitational quadrupole coefficient J2 */
	readonly j2: number
	readonly equatorialRadiusKm: number
}

/**
 * J2 and equatorial radius of the planets with moons (JPL planetary fact sheets), used for
 * the Laplace radius that decides whether a moon's source inclination refers to the planet's
 * equator or to its orbit. Mercury and Venus have no moons and are left out.
 */
export const PLANET_OBLATENESS: Readonly<Partial<Record<string, Oblateness>>> =
	{
		earth: { j2: 0.00108263, equatorialRadiusKm: 6378.137 },
		mars: { j2: 0.00196045, equatorialRadiusKm: 3396.19 },
		jupiter: { j2: 0.014736, equatorialRadiusKm: 71492 },
		saturn: { j2: 0.016298, equatorialRadiusKm: 60268 },
		uranus: { j2: 0.003343, equatorialRadiusKm: 25559 },
		neptune: { j2: 0.003411, equatorialRadiusKm: 24764 },
	}
