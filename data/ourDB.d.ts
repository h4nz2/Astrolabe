// Hand-written shape of data/ourDB.json (le-systeme-solaire.net export + curated fields).
// Cast the JSON import through `OurDatabase`; TypeScript's inferred literal type is huge.
export interface OurDatabase {
	suns: SunsEntity[]
	planets: PlanetsEntity[]
	dwarfPlanets: DwarfPlanetsEntity[]
	asteroids: AsteroidsEntity[]
	comets: CometsEntity[]
	asteroidBelt: AsteroidBelt
	kuiperBelt: KuiperBelt
}
export interface SunsEntity {
	id: number
	name: string
	isPlanet: boolean
	moons?: null
	diameter: number
	semimajorAxis: number
	perihelion: number
	aphelion: number
	eccentricity: number
	inclination: number
	mass: Mass
	vol: Vol
	escape: number
	meanRadius: number
	equaRadius: number
	polarRadius: number
	flattening: number
	dimension: string
	sideralOrbit: number
	sideralRotation: number
	aroundPlanet?: null
	discoveredBy: string
	discoveryDate: string
	alternativeName: string
	axialTilt: number
	mainAnomaly: number
	argPeriapsis: number
	longAscNode: number
	bodyType: string
	gravity: number
	density: number
	avgTemp: number | string
	composition: Composition
	textures: Textures
}
export interface Mass {
	massValue: number
	massExponent: number
}
export interface Vol {
	volValue: number
	volExponent: number
}
export interface Composition {
	majorElements?: MajorElementsEntity[] | null
}
export interface MajorElementsEntity {
	abbr: string
	element: string
	percentageOfComposition: number
}

export interface PlanetsEntity {
	id: number
	name: string
	diameter: number
	lengthOfDay: number
	distanceFromParent: number
	orbitalPeriod: number
	orbitalVelocity: number
	orbitalInclination: number
	orbitPositionOffset: number
	rings: boolean | Rings
	textures: Textures
	isPlanet: boolean
	moons?: MoonsEntity[] | null
	satellites?: SatellitesEntity[] | null
	semimajorAxis: number
	perihelion: number
	aphelion: number
	eccentricity: number
	inclination: number
	mass: Mass
	vol: Vol
	density: number
	gravity: number
	escape: number
	meanRadius: number
	equaRadius: number
	polarRadius: number
	flattening: number
	dimension: string
	sideralOrbit: number
	sideralRotation: number
	aroundPlanet?: null
	discoveredBy: string
	discoveryDate: string
	alternativeName: string
	axialTilt: number
	avgTemp: number
	mainAnomaly: number
	argPeriapsis: number
	longAscNode: number
	bodyType: string
}
export interface Rings {
	innerRadius: number
	outerRadius: number
	textures: Textures
}

export interface Textures {
	base: string
	topo?: string | null
	specular?: string | null
	clouds?: string | null
}
export interface MoonsEntity {
	id?: string | null
	name?: string | null
	englishName?: string | null
	isPlanet?: boolean | null
	moons?: null
	moon?: string
	semimajorAxis?: number | null
	perihelion?: number | null
	aphelion?: number | null
	eccentricity?: number | null
	inclination?: number | null
	mass?: Mass | null
	vol?: Vol | null
	density?: number | null
	gravity?: number | null
	escape?: number | null
	meanRadius?: number | null
	equaRadius?: number | null
	polarRadius?: number | null
	flattening?: number | null
	dimension?: string | null
	sideralOrbit?: number | null
	sideralRotation?: number | null
	aroundPlanet?: AroundPlanet | null
	discoveredBy?: string | null
	discoveryDate?: string | null
	alternativeName?: string | null
	axialTilt?: number | null
	avgTemp?: number | null
	mainAnomaly?: number | null
	argPeriapsis?: number | null
	longAscNode?: number | null
	bodyType?: string | null
	rel?: string | null
	ISS?: ISS | null
}

export interface AroundPlanet {
	planet: string
	rel: string
}
export interface ISS {
	distanceFromParent: number
}
export interface SatellitesEntity {
	id: string
	name: string
	diameter: number
	mass: number | string
	distanceFromParent: number
	orbitalPeriod: number | string
	orbitalInclination: number
	gravity?: number | null
	surfaceTemps: SurfaceTemps
	textures: Textures
}
export interface SurfaceTemps {
	min?: number | null
	max?: number | null
	mean?: number | null
}

export interface DwarfPlanetsEntity {
	id: number
	name: string
	diameter: number
	lengthOfDay: number
	distanceFromParent: number
	orbitalPeriod: number
	orbitalVelocity: number
	orbitalInclination: number
	rings: boolean
	textures: Textures
	isPlanet?: boolean | null
	moons?: Omit<MoonsEntity, "ISS">[] | null
	satellites?: SatellitesEntity[] | null
	semimajorAxis?: number | null
	perihelion?: number | null
	aphelion?: number | null
	eccentricity?: number | null
	inclination?: number | null
	mass?: Mass | null
	vol?: Vol | null
	density?: number | null
	gravity?: number | null
	escape?: number | null
	meanRadius?: number | null
	equaRadius?: number | null
	polarRadius?: number | null
	flattening?: number | null
	dimension?: string | null
	sideralOrbit?: number | null
	sideralRotation?: number | null
	aroundPlanet?: null
	discoveredBy?: string | null
	discoveryDate?: string | null
	alternativeName?: string | null
	axialTilt?: number | null
	avgTemp?: number | null
	mainAnomaly?: number | null
	argPeriapsis?: number | null
	longAscNode?: number | null
	bodyType?: string | null
}

export interface AsteroidsEntity {
	asteroidBelt?: AsteroidBelt | null
	kuiperBelt?: KuiperBelt | null
	id?: string | null
	name?: string | null
	englishName?: string | null
	isPlanet?: boolean | null
	moons?: Pick<MoonsEntity, "moon" | "rel">[] | null
	semimajorAxis?: number | null
	perihelion?: number | null
	aphelion?: number | null
	eccentricity?: number | null
	inclination?: number | null
	mass?: Mass | null
	vol?: Vol | null
	density?: number | null
	gravity?: number | null
	escape?: number | null
	meanRadius?: number | null
	equaRadius?: number | null
	polarRadius?: number | null
	flattening?: number | null
	dimension?: string | null
	sideralOrbit?: number | null
	sideralRotation?: number | null
	aroundPlanet?: null
	discoveredBy?: string | null
	discoveryDate?: string | null
	alternativeName?: string | null
	axialTilt?: number | null
	avgTemp?: number | null
	mainAnomaly?: number | null
	argPeriapsis?: number | null
	longAscNode?: number | null
	bodyType?: string | null
	rel?: string | null
}
export interface AsteroidBelt {
	count: number
	distanceFromParent: SurfaceTempsOrDistanceFromParent
	textures: Textures
}
export interface SurfaceTempsOrDistanceFromParent {
	min: number
	max: number
}
export interface KuiperBelt {
	count: number
	diameter: number
	radius: number
	distanceFromParent: SurfaceTempsOrDistanceFromParent
	textures: Textures
}

export interface CometsEntity {
	id: string
	name: string
	englishName: string
	isPlanet: boolean
	moons?: null
	semimajorAxis: number
	perihelion: number
	aphelion: number
	eccentricity: number
	inclination: number
	mass?: Mass | null
	vol?: null
	density: number
	gravity: number
	escape: number
	meanRadius: number
	equaRadius: number
	polarRadius: number
	flattening: number
	dimension: string
	sideralOrbit: number
	sideralRotation: number
	aroundPlanet?: null
	discoveredBy: string
	discoveryDate: string
	alternativeName: string
	axialTilt: number
	avgTemp: number
	mainAnomaly: number
	argPeriapsis: number
	longAscNode: number
	bodyType: string
	rel: string
}
