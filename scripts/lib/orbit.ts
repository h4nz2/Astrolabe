/** Gravitational constant in km^3 kg^-1 s^-2 (CODATA 2018: 6.6743e-11 m^3 kg^-1 s^-2). */
export const G_KM3_PER_KG_S2 = 6.6743e-20

export const SECONDS_PER_DAY = 86400

/**
 * Sidereal orbital period in days from Kepler's third law, P = 2 pi sqrt(a^3 / (G M)),
 * treating the orbiting body's mass as negligible against the central mass.
 * Used only when the source has a semi-major axis but no period.
 */
export const periodDaysFromKepler = (
	semiMajorAxisKm: number,
	centralMassKg: number,
): number => {
	if (semiMajorAxisKm <= 0 || centralMassKg <= 0) {
		throw new RangeError("semi-major axis and central mass must be > 0")
	}
	const seconds =
		2 *
		Math.PI *
		Math.sqrt(semiMajorAxisKm ** 3 / (G_KM3_PER_KG_S2 * centralMassKg))
	return seconds / SECONDS_PER_DAY
}

/**
 * Laplace radius of a planet in km: well inside it a satellite's orbit precesses about the
 * planet's equator (its Laplace plane is the equator), well outside it about the planet's
 * orbit normal (the Laplace plane is close to the ecliptic). Classical estimate
 *
 *   r_L^5 = J2 R^2 a^3 (1 - e^2)^(3/2) M_planet / M_sun
 *
 * (e.g. Tremaine, Touma & Namouni 2009), for a satellite of negligible mass.
 */
export const laplaceRadiusKm = (
	j2: number,
	equatorialRadiusKm: number,
	planetSemiMajorAxisKm: number,
	planetEccentricity: number,
	planetMassKg: number,
	sunMassKg: number,
): number => {
	if (
		j2 <= 0 ||
		equatorialRadiusKm <= 0 ||
		planetSemiMajorAxisKm <= 0 ||
		planetMassKg <= 0 ||
		sunMassKg <= 0 ||
		planetEccentricity < 0 ||
		planetEccentricity >= 1
	) {
		throw new RangeError("Laplace radius needs positive inputs and 0 <= e < 1")
	}
	const oblateness = j2 * equatorialRadiusKm ** 2
	const orbit =
		planetSemiMajorAxisKm ** 3 * (1 - planetEccentricity ** 2) ** 1.5
	return (oblateness * orbit * (planetMassKg / sunMassKg)) ** 0.2
}

/** Mean density in kg/m^3 of a sphere of `radiusKm` and `massKg`. */
export const densityKgPerM3 = (massKg: number, radiusKm: number): number =>
	massKg / ((4 / 3) * Math.PI * (radiusKm * 1000) ** 3)
