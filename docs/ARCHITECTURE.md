# Astrolabe architecture (rebuild, September 2026)

A true-scale, interactive 3D model of the solar system (Sun, planets, moons) plus the visual dictionary and hero page,
shipped as a client-only static site. This is the shared contract for humans and agents working on the rebuild: follow
it, and if it must change, change it in the same change set.

## Stack

- Vite + React 19 + TypeScript (strict), pnpm, Node 22 (`.nvmrc`).
- TanStack Router, file routes in `src/routes`. URLs stay `/`, `/solar_dictionary`, `/solar_system`. Search params are
  zod-validated and invalid values fall back to defaults (`/solar_dictionary?entity=<0..8>&texture=<base|topo|specular|clouds>`).
- 3D: `three`, `@react-three/fiber` 9, `@react-three/drei` 10, `@react-three/postprocessing` 3.
- UI: Mantine 9 + CSS modules (no emotion, `createStyles` or `sx`), `@tabler/icons-react`. Animation: `gsap`. State: `zustand`.
- Data: static JSON validated with zod at build time. No GraphQL, no server.
- Tests: Vitest (`src/**/*.test.ts`, `scripts/**/*.test.ts`); Playwright smoke tests (`e2e/`, against `vite preview`).
  `astronomy-engine` is a test-only reference ephemeris.
- ESLint 10 flat config + typescript-eslint + react-hooks; Prettier (tabs, no semicolons).
- Hosting: static `dist/`, `VITE_BASE` sets Vite `base`. CI (GitHub Actions): typecheck, lint, test, build, e2e, deploy
  to GitHub Pages. Cloudflare Workers also serves `dist/` (`wrangler.jsonc`, SPA fallback, `npx wrangler deploy`;
  `wrangler` is a pinned devDependency).
- Known noise: fiber 9.8 logs a `THREE.Clock` deprecation once per `<Canvas>` mount. Do not pin `three` down for it.

## Directory layout

```
data/ourDB.json              raw source (le-systeme-solaire.net export + curated fields); only solarDictionary.ts imports it
data/rings/<planet>.json     ring systems the source lacks (Uranus, Neptune)
scripts/build-bodies.ts      data/ -> src/data/bodies.json (pnpm build:data); the pure, tested mapping lives in scripts/lib/
scripts/gen-ring-textures.ts data/rings -> public/assets/textures/<planet>/rings/ (pnpm gen:rings)
src/routes/                  file routes; src/routeTree.gen.ts is generated and committed
src/providers/               Mantine theme, I18nProvider, GSAP transition context, Layout
src/i18n/                    languages and reading levels (see i18n); body content in bodies.ts ("@/i18n/bodies")
src/locales/                 translation resources: config.json, <locale>/ui.json, <locale>/bodies.json
src/data/                    bodies.json, schema.ts (zod), index.ts (lookups), solarDictionary.ts (dictionary + hero adapter)
src/sim/                     pure simulation, no React or three objects (import from "@/sim"); testing/ is test-only
src/store/                   sim.ts, navigation.ts, scale.ts, lighting.ts, simSearch.ts (URL schema), urlSync.ts
src/features/                hero/, solarDictionary/, solarSystem/ (index.tsx, scene/, bodies/, camera/, lighting/, ui/)
src/GSAPAnimation/ hooks/ primitives/ utils/   shared bits
public/assets/textures/      pruned; unreferenced tiered variants are kept for later phases
```

## Conventions

- Path alias `@/*` -> `src/*`. Public assets are URL strings built with `assetUrl()` (`src/utils/assetUrl.ts`), never
  imported, so `VITE_BASE` sub paths work.
- Function components, `export default` at the bottom, props types exported next to the component.
- CSS modules or Mantine style props; dark scheme, primary `orange.7`. No SSR leftovers (`next/*`, `ssr: false`, mount gates).
- Per-frame motion never goes through React state: `useFrame` and mutate refs.
- Every user-facing string goes through i18n (`useI18n().t`, see i18n) with an entry in every shipped locale; numbers,
  units and dates through its formatters, body names through `bodyName`/`useBodyName`, never `body.name`.
- Nobody commits; the orchestrator commits at the end of each phase.
- Done means `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass (plus `pnpm test:e2e` when the UI changed).

## Data model (`src/data/schema.ts`)

```ts
type BodyKind = "star" | "planet" | "moon"

interface Orbit {
	semiMajorAxisKm: number
	eccentricity: number
	inclinationDeg: number // to the ecliptic
	longAscNodeDeg: number
	argPeriapsisDeg: number
	meanAnomalyDeg: number // at epochJD
	periodDays: number // sidereal
	epochJD: number // 2451545.0 (J2000)
	phaseSynthetic?: boolean // node/periapsis/anomaly spread deterministically from hash(id)
	precession?: { nodeDegPerDay: number; argPeriapsisDegPerDay: number } // secular turning (the Moon only)
}

interface Body {
	id: string // unique slug: "sun", "earth", "io", "s2003j24"
	name: string
	kind: BodyKind
	parentId: string | null // null only for the Sun
	radiusKm: number
	radiusEstimated?: boolean
	massKg: number | null
	orbit: Orbit | null // null only for the Sun
	rotation: {
		periodHours: number | null // sidereal; negative = retrograde (the only retrograde encoding)
		axialTiltDeg: number // to the IAU north pole, 0..90
		poleRaDeg?: number // IAU 2015 pole + W0 at J2000 (Sun, planets, Moon)
		poleDecDeg?: number
		primeMeridianDeg?: number
	}
	textures: {
		base: string
		topo?: string
		specular?: string
		clouds?: string
		night?: string
	}
	rings: {
		innerRadiusKm: number
		outerRadiusKm: number
		textures: { alpha: string; color: string }
	} | null
	info: Record<string, unknown> // dictionary fields passed through; a source 0 ("unknown") is dropped
}
```

`bodies.json` holds physics and presentation hints only, as an array in topological order (parents first): the Sun, the
8 planets and their moons (dwarf planets, asteroids and comets are in the source but not emitted yet). Editorial content
lives in the i18n resources (#11), keyed by body `id`, so a new body is added by data alone and its story as content.

`src/data/bodies.json` is a committed, deterministic build artifact. CI runs `pnpm check:data` (rebuild +
`git diff --exit-code`), so rebuild after changing `data/`, `scripts/` or the textures.

Build rules (`scripts/lib/`):

- Moons are merged from the source's `moons` (API export) and `satellites` (curated) arrays by normalized English name;
  `ISS` is skipped; curated-only moons are built from their curated fields; a missing period is derived from Kepler's
  third law (`info.periodDerived`). Untextured moons get the shared placeholder `earth/satellites/moon_1k.jpg`.
- Moon phases are all 0 in the source, so they are spread from `hash(id)` and flagged `phaseSynthetic`. Only the Moon and
  the Galileans have real (curated) phases.
- Retrograde spin is normalized to one encoding: tilt to the IAU pole (`180 - obliquity`) plus a negative period.
- IAU poles and prime meridians (WGCCRE 2015 at J2000) for the Sun, planets and Moon come from `scripts/lib/iau.ts`.
- Moon inclinations refer to the Laplace plane: inside the planet's Laplace radius they are rotated from the planet's
  equator into the ecliptic (`frames.ts`), so regular moons and rings are coplanar; outside it they are kept as ecliptic.
- Rings: Jupiter and Saturn from the source, Uranus and Neptune from `data/rings/`. Strips run u = 0 (inner) to u = 1
  (outer). A missing ring texture fails the build.
- Corrections to the source (typos, planet J2000 elements from JPL/Standish, the Moon and Galileans' elements, the
  Moon's precession rates from Meeus ch. 47 and its true sidereal month 27.321661 d) are made in `data/ourDB.json` itself. Sanity checks (Kepler period, density) warn on stderr.

## Simulation (`src/sim`, pure and unit-tested)

- Time is a Julian Date (`simTimeJD`, `J2000 = 2451545.0`). The clock (`clock.ts`, #9) is an immutable `SimTimeline`
  `{ anchorJD, anchorMs, rate, glide }` evaluated as `anchorJD + (realMs - anchorMs) * rate / MS_PER_DAY`: nothing
  accumulates per frame, so time is frame-rate independent and does not drift. Rate is simulated seconds per real
  second (negative runs backwards). `retimeTimeline` re-anchors on a rate change, `jumpTimeline` jumps,
  `glideTimeline` eases to a target (up to 2.5 s, log of the distance). `skipFrameGap` counts at most 250 ms of a frame
  gap (hidden tab, sleep) except at rate 1, so a clock showing the present keeps showing it.
- Units: 1 scene unit = 1000 km (`toUnits`, `toKm` in `units.ts`); nothing else hard-codes the scale.
- Frame: three.js is Y-up; ecliptic (xe, ye, ze) maps to scene (xe, ze, -ye), so the ecliptic is the XZ plane (`kepler.ts`).
- `propagate(orbit, jd, out)` gives the parent-centric position in km (Newton iteration, e up to 0.99), including
  Kepler's second law. `computePositions(bodies, jd, out)` fills world positions in topological order, in doubles.
- Precession (#22): an orbit with `precession` turns linearly (node and argument of periapsis), its mean anomaly slower
  by their sum, so `periodDays` stays the sidereal period of the mean longitude. `orbitAt(orbit, jd)` is the fixed
  ellipse the body is on at `jd`; `propagate` uses it and orbit lines resample from it every 0.05 deg of turn. Only the
  Moon has it (node 18.6 yr, perigee 8.85 yr): without it the Moon drifts 16 deg off by 2045 and eclipses land on the
  wrong dates; with it, real eclipses happen within about three hours of the real ones.
- Rotation (`rotation.ts`): `spinAxis` (IAU pole, else the orbit normal tilted by `axialTiltDeg`), `equatorNode` (zero
  of the prime meridian) and `rotationAngle(rotation, jd)` (unwrapped, sign from the period). A mesh is oriented with
  X = equatorNode, Y = spinAxis, Z = X x Y, then rotated about Y.
- Per-frame callers build the index once (`buildIndex`) and pass reused `out` arrays: the frame loop allocates nothing.
- Accuracy: planets within 0.2 deg / 0.15 % of astronomy-engine over J2000 +- 2000 d (`positions.test.ts`); the Moon
  within 2.5 deg over 2000-2045 (`precession.test.ts`; evection and variation are not modelled) and the Galileans within
  a few degrees; everything else has fictitious phases.

## Scale (`src/sim/scale.ts`, `src/store/scale.ts`; #8)

The simulation and every fact shown as text use true kilometres. Only what is drawn goes through the scale engine,
which applies three independent, named lies ("display space"):

```ts
interface SizeCurve {
	exponent: number
} // drawn radius = rootRadius * (radius / rootRadius) ** exponent
interface DistanceCurve {
	knee: number
	exponent: number
	gain: number
} // parent radii -> drawn parent radii
interface ScaleSettings {
	bodySize: SizeCurve
	orbitDistance: DistanceCurve
	moonDistance: DistanceCurve
}
```

- The Sun always keeps its true size. `orbitDistance` places the root's children, `moonDistance` everything deeper
  (`childDistanceCurve` decides by depth, never by kind).
- A distance curve is the identity up to `knee`, then `knee * (1 + gain * ((x / knee) ** exponent - 1))`: monotone and
  never below `min(x, knee)`, so nothing is drawn inside its parent.
- The one rule: display position = parent's display position + the true parent -> child direction, rescaled to
  `parentDrawnRadius * curve(trueDistance / parentTrueRadius)` (`displayOffset`, `computeDisplayPositions`). Directions
  are true in every preset; anything measured between non-parent/child bodies must use true positions.
- Derived visuals have no factors of their own: meshes, orbit lines, markers, camera framing and body-attached lengths
  (`displayBodyLengthKm`) all derive from the drawn radius and `displayOffset`. Non-body objects near an anchor body map
  through the same `displayOffset`.

| preset              | bodySize | orbitDistance (knee, exp, gain) | moonDistance (knee, exp, gain) | reads as                                                 |
| ------------------- | -------- | ------------------------------- | ------------------------------ | -------------------------------------------------------- |
| `trueScale`         | 1        | 1, 1, 1                         | 3, 1, 1                        | real sizes and distances; planets are specks             |
| `textbook`          | 1        | 1, 0.53, 0.12                   | 3, 0.2, 1                      | sizes true to each other, distances squeezed hard        |
| `everythingVisible` | 0.5      | 1, 0.52, 1                      | 3, 0.2, 2                      | **the default**: small bodies enlarged, orbits pulled in |

`scale.test.ts` guards the non-true presets (orbit order kept, moon systems separated, rings and ring moons true to
proportion). `interpolateScale` blends presets for animated changes; also `presetOf`, `sameScale`, `isValidScale`,
`sizeExaggeration`, `distanceFactor`. The store (`useScaleStore`: `scale`, `presetId`, `setPreset`, `setScale`,
`setFactor`) is not persisted or in the URL. `scene/ScaleSync.tsx` pushes it into the SimFrame and sets
`data-scale-preset` on the canvas. On a scale change the camera keeps the framed body's on-screen size.

## Navigation (`src/store/navigation.ts`, `features/solarSystem/camera`; #10)

The camera director is the only code that touches the camera, controls or render origin; features ask the store for a
view (an ESLint rule keeps drei camera controls inside `camera/`). The navigation slice lives in `useSimStore`:

```
selectedId: string | null   drives info panels, labels, the URL; never moves the camera
view: View                  { kind: "overview" } | { kind: "body", id } | { kind: "point", anchorId, offsetKm }
                            (a point: offsetKm is TRUE km from the anchor, drawn through the scale engine; #15)
focusId: string             body the view is centred on (the Sun for the overview, a point's anchor)
shot: CameraShot | null     { azimuthDeg, elevationDeg, distance } at rest; distance is a multiple of the default framing
transition, sequence        the running move and the running tour
panning: boolean            a pan (or its damped glide) is moving the pivot right now
viewMode(state)             "overview" | "focused" | "free" | "transit"
```

Actions: `select`, `setFocus` (click: select + focus), `focus`, `overview`, `goTo(view, request?)`, `jumpTo`, `reset`
(the way out), `skip`, and sequences (`playSequence`, `goToStep`, `nextStep`, `resumeSequence`, `stopSequence`). A
request carries a partial `shot`, `durationMs` and a `profile`. Invalid views and unknown bodies are ignored.
Camera-rig callbacks, not for features: `settle`, `userInput`, `publishShot`, `settleAt`, `setPanning`, `tickSequence`.

Director (`camera/director.ts`, unit-tested frame by frame):

- Every request starts a new move from wherever the camera is, so retargeting mid-flight never snaps back. Both pivots
  and the arrival distance are re-read every frame.
- User input during a move takes over distance and direction while the pivot still glides home; it also interrupts
  automatic sequence steps. A pan while settled is folded into a pending pan (nothing moves on screen) and committed
  when released (see Re-centring).
- A non-finite camera or a view of a missing body resets to the overview.
- Profiles (`camera/profiles.ts`): the default `smooth` is van Wijk and Nuij's zoom-and-pan (`camera/pose.ts`), 0.8–3 s.
- `window.__astrolabe` (`camera/debugHandle.ts`) exposes `camera()` (`director.snapshot()`) and the store for the
  console and e2e tests. Read the camera, never write it.

### Re-centring and free movement (`camera/recentre.ts`, `camera/input.ts`; #15)

- Gestures: orbit = left button / one finger; dolly = wheel, trackpad scroll, pinch, ctrl+wheel, middle button; pan =
  right button (trackpad two-finger click-drag), Shift + left (`shiftDragPans`), two fingers together, three fingers.
  Pans are camera-controls' `SCREEN_PAN`: the pivot slides parallel to the ecliptic, like dragging a map.
- A pan is committed after the controls' update once released and the glide is within 1e-4 of the camera distance of
  its end (not on camera-controls' `rest`, which fires mid-drag and uses an absolute 10 km threshold). The rest of the
  glide is folded in, so the commit moves nothing on screen. Then:
  - **Snap** (`snapTarget`): if the screen centre is on a drawn body's disc or within `SNAP_FOV_FRACTION` (1.2 % of the
    vertical fov, about 11 px) of a drawn body, the pivot glides onto it (450 ms, distance kept). The view it came from
    is kept when that is the body (a pan that never left the planet snaps back; a small pan in the overview stays the
    overview); the Sun means the overview. Camera gestures never change the selection.
  - **Point** otherwise: anchored to the innermost body whose drawn Hill sphere (at least 4 drawn radii; the Sun owns
    everything) holds it (`neighbourhoodOf`), offset stored in TRUE km (`pointOffsetKm`, via `trueOffset` /
    `unmapDistance` in `src/sim/scale.ts`) and drawn with `pointDisplayKm`, so it keeps its place under every preset.
- Limits follow the centre: a point uses its anchor's `minViewDistance`; a point anchored to the Sun is framed
  (`defaultDistance`) like the overview.
- HUD: `ui/CentreMarker.tsx` (crosshair at the canvas centre while `panning` or free), `ui/CentreBadge.tsx` ("Free view
  near Mars" + "Centre on Mars", or "in interplanetary space" + "Back to overview"); the picker shows no body while free.
  `ui/centre.ts` holds `freeCentreId` (stable selector) and the strings.
- Building on it: #16 clicks call `setFocus` (see Picking); #31 anchors the frame to `focusId` (a point's anchor).

## Lighting (`src/sim/lighting.ts`, `features/solarSystem/lighting/`, `src/store/lighting.ts`; #22)

The single authority on how anything is lit. The Sun (the root body) is the only light source; there are no three.js
lights. Everything is decided in TRUE km (`positionsKm`, `radiusKm`), never in display space, so the terminator, phases
and eclipses are the real ones in every scale preset (a moon drawn 10x too big never casts a 10x bigger shadow).

- Direction: each body is lit from the true Sun direction from its centre (`uSunKm`). A fragment of the drawn sphere
  stands for the true surface point in the same direction (`normal * radiusKm`), so a true shadow lands on the same
  spot of the enlarged globe.
- Shading (`sunlightShader.ts`): Lambert x the Sun's visible fraction x `SUN_INTENSITY` 1.6, ACES tone mapping, no
  distance falloff (a 900x dimmer Neptune would be a black disc). The night side keeps `NIGHT_LEVEL` (4.5 % "starlight")
  and a faint cool rim, and shows `textures.night` (Earth's city lights): not physical, deliberately legible.
- Eclipses are analytic: `sunVisibleFraction(point, sun, sunRadius, casters)` is the visible share of the Sun's disc
  (exact lens area of the angular discs: umbra, penumbra, annular), casters multiply. The shader's `sunVisibility()` is a
  line-by-line port; keep them in step (the TypeScript one is tested, including the 2024-04-08 solar and 2025-03-14
  lunar eclipses). Casters (`occluderCandidates`): a moon's planet and siblings, a planet's moons; the Sun casts and
  receives nothing. `selectOccluders` keeps up to `MAX_OCCLUDERS` (4) that can reach the body this frame; hidden bodies
  cast no shadow.
- Uniforms: one `SunlightUniforms` per body (`createSunlightUniforms`), rewritten in BodyMesh's `useFrame` by
  `updateSunlight`. Materials share the uniform OBJECTS (`createSunlitMaterial`, passed as a `<primitive>`): R3F's
  `<shaderMaterial uniforms>` copies each uniform and would freeze scalars at mount.
- "Always lit" (`useLightingStore.alwaysLit`, a HUD switch labelled by `solarSystem.layers.alwaysLit`; not persisted): lit from the viewer, no night, no shadows.
- Phases and seasons are consequences, not features (`phaseAngle`, `illuminatedFraction` give the numbers).
- Building on it: anything lit by the Sun (#12 rings, #23, #35) includes `SUNLIGHT_PARS`, shares its body's uniforms and
  calls `sunVisibility(p)` with `p` in that body's true frame (centre at origin, true km). Ring points:
  `p = local * radiusKm / drawnRadiusKm`; the planet's shadow on its rings is the planet as a caster at the origin. Ring
  shadows on the planet: intersect the ray from `p` toward `uSunKm` with the equatorial plane and multiply by
  `1 - ringAlpha(r)` inside the ring radii, behind a define so ringless bodies pay nothing.

## Floating origin

GPU positions are float32, so the render origin is the camera's pivot in display space:
`renderPos(b) = toUnits(display(b) - origin)`, computed in doubles every frame. The controls always target (0, 0, 0).
The canvas uses a logarithmic depth buffer. Orbit lines are rebuilt relative to the origin when it moves, so nothing
near the camera jitters.

## Store (`src/store/sim.ts`)

```
simTimeJD, timeWarp, paused, clock, lastTickMs    time; change only through the actions below
hoverId, showOrbits, showLabels, showMoons, showMarkers
...NavigationSlice
setTimeWarp(n), togglePause(), setPaused(b)       re-anchor the clock: nothing moves at the change
setSimTime(jd)                                    instant jump
travelTo(jd, durationMs?), setNow()               glide; arrival is clock.glide === null
tick(realMs)                                      SimClock only
WARP_PRESETS                                      speeds (plain numbers): 1x, 1 min/s, 1 h/s, 1 day/s, 1 week/s,
                                                  1 month/s, 1 year/s, 10 years/s
```

Anything positioned in time is a pure function of a JD, never of frames. In `useFrame` read `useSimStore.getState()`;
React UI subscribes with selectors, and reads the clock only through `useThrottledSimTime()` (10 Hz).

URL: `/solar_system?focus=io&sel=europa&cam=<az_el_dist>&t=<jd>&warp=<n>&moons=false`. The layer switches `orbits`,
`labels`, `moons`, `markers` (`LAYER_PARAMS` in `urlSync.ts`) are written as `=false` while off. Defaults (overview,
home shot `0_45_1`, `warp=1`, a switch that is on) are left out; a link without a switch turns it on. `simSearch.ts` drops
invalid or blank values (never coerces them to 0). `useSimUrlSync()` runs once, in `<UrlSync />` rendered before
`<Scene />`: it seeds the store before the Canvas mounts (no `t` means the wall clock at mount), then writes back with
`replace: true`, `t` at most once per second and only while paused or at |warp| <= 60.

## Rendering and runtime contract (`src/features/solarSystem`)

Everything under the Canvas shares one mutable `SimFrame` through context, created once per Canvas, mutated every frame,
never causing re-renders:

```ts
// scene/simFrame.ts
export interface SimFrame {
	bodies: readonly Body[]
	index: ReadonlyMap<string, number>
	positionsKm: Float64Array // true positions (physics only)
	displayKm: Float64Array // display positions (what is drawn)
	displayRadiiKm: Float64Array // drawn radii, rewritten on a scale change
	originKm: Float64Array // render origin in display km, written by the camera director
	jd: number
	scale: ScaleSettings // change with setSimFrameScale only
	scaleVersion: number // bumps on scale change; cache scale-derived geometry on it
	renderPosition(i: number, out: Vector3): Vector3
	renderPositionOf(id: string, out: Vector3): Vector3
	renderRadius(i: number): number
}
export function createSimFrame(bodies: readonly Body[], jd?: number, scale?: ScaleSettings): SimFrame
export function updateSimFrame(frame: SimFrame, jd: number, originIndex?: number): void
export function setSimFrameScale(frame: SimFrame, scale: ScaleSettings): void
export const useSimFrame = (): SimFrame // throws outside the provider
```

- Frame order: `SimClock` (`useFrame` priority -1) ticks the store and updates the SimFrame; the camera director
  (-0.5) writes the origin and the camera; everything else draws at the default priority and only reads.
- Per-frame writes live in exported plain functions taking the objects they mutate (`updateSimFrame`,
  `updateOrbitBuffers`, `fillMarkers`) to satisfy `react-hooks/immutability` without `eslint-disable`. No allocations
  in the frame loop.
- Canvas: `dpr={[1, 2]}`, logarithmic depth buffer, near 1e-5, far 1e9, fov 45 (`camera/framing.ts`), background
  `#0b0d12`. No three.js lights (see Lighting); the Sun is unlit (`toneMapped={false}`). Bloom arrives in Phase 6.
- Bodies (`bodies/BodyMesh.tsx`): a group per body, scaling one of three shared unit spheres (64/32/16 segments for
  Sun and planets / moons / estimated moons) by the drawn radius; lazy sRGB textures behind a per-body Suspense; every
  body but the Sun uses the sunlit material (see Lighting).
- Rings: radial UVs, `alphaMap` = alpha strip (linear, gray level = opacity; never use it as `map`), `map` = color strip
  (sRGB), clamped, double-sided. Brighten dark generated rings in the material, not the data.
- Orbit lines (`bodies/OrbitLine.tsx`): 256 samples plus one anchor vertex written from the body's own position, so the
  line always passes through its body. Rebuilt on scale or large origin/parent moves; otherwise only the anchor updates.
  Use `LineBasicMaterial` on a raw `<threeLine>` registered with `extend({ ThreeLine: Line })` (without it any re-render
  throws). Not drei `<Line>`: it lacks logdepth and depth-fights. Headless SwiftShader drops the focused orbit in
  close-ups; not an app bug.
- Markers: one `Points` layer (4 px round dots, no depth test) so nothing vanishes at true scale; a dot hides once its
  body is wider than 6 px, and moon dots show only within the focused family (`isMoonDotShown`). The dots are drawn
  only; picking is `BodyPicking`'s (see Picking). Labels: planets always, moons only within the focused family.
- Camera (`camera/framing.ts`, `camera/input.ts`): `minDistance = max(1.2 R, R + 2 near)` of the drawn radius, bodies
  framed from 6 radii, the overview fits the drawn planetary system x 1.3 from azimuth 0 / elevation 45. Orbit with
  left button or one finger; dolly with wheel, pinch (ctrl+wheel via `pinchAsDolly`) or middle button; pan with the right
  button, Shift + left, two or three fingers (see Re-centring). A point's zoom limits are its anchor's.
- Visibility: `isBodyShown(body, state)` is the one rule for meshes, orbits and markers; hiding moons never hides the focus.
- HUD (`ui/`, plain React over the Canvas, selectors only, never the SimFrame): `TimeControls`, `SceneToggles`,
  `FocusPicker`, `OverviewButton`, `BodyInfo` (the focused view's card, see Picking), `LanguageMenu` (in the
  toggles panel), `CentreBadge` and `CentreMarker` (#15). Escape, the overview button, the card's close button and a click on empty space call `reset()`. The clock shows the locale's date format inside
  `<time dateTime="2026-09-24T10:35Z">`; warp labels come from the value (`ui/warp.ts` `warpParts`).
  Keys (ignored in fields and with modifiers): Space pause, `+`/`-` next faster/slower preset (direction kept),
  ArrowLeft/Right cycle siblings.
- Page (`index.tsx`): `<UrlSync />`, then `scene/Scene.tsx` (Canvas + `SimFrameContext.Provider`, `ScaleSync`,
  `SimClock`, `HoverCursor`, `Bodies`, `OrbitLines`, `Markers`, `BodyPicking`, `CameraRig`, `HighlightTracker`, later
  `Effects`), `ui/BodyHighlight`, and the HUD.

## Picking: click a body to focus on it (`scene/picking.ts`, `scene/BodyPicking.tsx`; #16)

One invisible object (`BodyPicking`, a `<group>` with its own `raycast`) is the scene's only click and hover target;
meshes and marker dots have no handlers. Its raycast asks `pickBody` (pure, unit-tested) and always reports a hit: a
body, or "empty space" at `CAMERA_FAR`, so other clickable scene objects (nearer) still win and stop propagation.

- **Disc**: the ray passes through the drawn sphere of a body drawn at least as big as the target; the nearest wins.
- **Generous target**: a body drawn smaller than `TARGET_RADIUS_PX` (mouse 12, pen 16, touch 24; by
  `currentPointerKind()` in `scene/tap.ts`) is hit anywhere within that radius of its centre, whatever its drawn size.
  A visible disc (radius >= 2 px) right under the pointer wins, then the Sun and planets beat moons, then the nearest
  edge; a small body in front of a big disc beats the disc, one behind it is hidden. Moons get a
  target only while their marker dot is drawn or their disc is at least 1 px (`hasGenerousTarget`), so a click into
  apparently empty space never flies to an invisible moon.
- **Click on a body** (`bodyClickAction`): `setFocus` (select + fly, framing 6 drawn radii, tracked); the focus after
  the camera was dollied beyond `REFRAME_DISTANCE` x its framing flies back to the close-up; the framed, selected
  focus does nothing. **Click on empty space** (`emptyClickAction`): `reset()` from a focused or free view,
  `select(null)` in the overview; nothing on a near miss (within `NEAR_MISS_FACTOR` x the target radius of a drawn
  edge) or while a sequence (tour) runs. Only taps count (`isTapEvent`).
- **Hover**: `hoverId` follows the pointer, but never for a finger or while a button is held (an orbit drag).
  `HoverCursor` shows `cursor: pointer` for click targets (`isClickTarget` = `bodyClickAction` is not `none`).
  `ui/BodyHighlight.tsx` renders a white ring with the body's name and "Click to fly there" around the hovered target,
  and an orange ring around the selected body while its disc is under 40 px; `scene/HighlightTracker.tsx` places both
  every frame straight on the DOM (`scene/highlight.ts` `placeRing`, `applyRing`), never through React state.
- **The focused view's card** (`ui/BodyInfo.tsx`): the selection, else the focused body; name, tagline, the first
  authored comparison, headline facts and a link to the dictionary entry (`ui/dictionaryEntry.ts`: Sun 0, planets
  1..8), plus a close button (`reset`). Facts are comparative first (`ui/bodyFacts.ts`, `solarSystem.facts.*`): size in
  Earths (Earth and moons in our Moon), a planet's distance as sunlight travel time, a moon's as how many of its
  planet fit into the gap, the year in Earth years or laps per Earth year, weight relative to Earth; the exact
  number sits under each. In the overview or a free view the card is a hint that planets can be clicked. On phones
  (< 600 px) the card sits above the time controls with its facts folded behind a toggle.
- `window.__astrolabe.screenOf(id)` gives a body's screen position and drawn radius, and `.scale` the scale store, for
  the console and e2e tests.
- Building on it: #17 moons (focus is how they are seen), #18 fly (clicks call `setFocus`; a fly profile can be
  requested through `focus(id, request)`), #20 labels (a label click calls `setFocus`), #24 compare (the card's action
  row takes "Compare with…"), #28/#29/#34 (select or focus through the store).

## Time controls (`features/solarSystem/ui`; #14)

Everything goes through the clock actions of #9; nothing here touches the clock directly.

- `TimeControls.tsx`: reverse / pause / play as one group with exactly one pressed (`aria-pressed`); reverse and
  play un-pause and set the sign of `timeWarp` (`withDirection` in `ui/warp.ts`), pause keeps speed and direction.
  The speed presets (a SegmentedControl, a Select below 720 px) set the magnitude and keep the direction: each
  step multiplies the speed, so the row is the non-linear scale. A speed that is no preset (from a URL) is shown as
  an extra item.
- `TimeTravel.tsx`: the HUD date is a button opening "Travel in time": named moments (`ui/moments.ts`, ids and UTC
  instants; the text is in the locales under `solarSystem.time.moments.<id>`) and a `@mantine/dates` calendar
  (`DayPicker.tsx`, loaded lazily; 1000-01-01..2999-12-31, a picked day is reached at 12:00 UTC). Every label of the calendar comes from `Intl` in
  the active format locale (`calendarLabels`, `firstDayOfWeek` in `ui/timeTravel.ts`), so a new locale needs no
  date locale data. Both use `travelAndStop(jd)`: pause, then `travelTo` — the glide lands paused, so the moment
  stays on screen and its `t` goes into the link. Tours (#28) and birthdays (#26) should reuse it.
- `TooFastHint.tsx` / `ui/tooFast.ts`: the wagon-wheel warning. When the fastest body in view (planets, plus the
  focused family's moons while shown) laps more than a sixth of an orbit per drawn frame (`TOO_FAST_LAPS_PER_FRAME`,
  frame rate measured by `useFrameRate()` from the ticks), a line under the presets names it and its laps per second.
  Nothing is capped or hidden in the scene; positions stay true.

## i18n: languages and reading levels (`src/i18n`, `src/locales`)

Two axes: the **locale** (language) and the **reading level** (`simple` 8–11, `standard` 12–15 and the default,
`advanced` 16+). Shipped locales: English (`en`, the reference and fallback) and German (`de`, standard German
orthography). Body names: the Sun, the planets and the major moons are translated ("Erde", "Ganymed"); every other
body keeps its catalogue name, and provisional designations (`S/2003 J 2`) are never translated.

### Resources (`src/locales`, no code)

```
src/locales/config.json          { defaultLocale, readingLevels (menu order), defaultReadingLevel }
src/locales/<locale>/ui.json     UI strings: a tree of ICU MessageFormat messages
src/locales/<locale>/bodies.json editorial body content, keyed by body id (src/data/bodies.json)
```

- Messages are ICU MessageFormat (plural, select, `{n, number}`, `{n, number, ::percent}`); never build sentences
  by concatenation. A plural must list every category of the language (`one`/`other` in en/de; the tests check).
- A reading-level variant is a sibling key with an `@level` suffix; the plain key serves the default level and every
  level without its own text: `"orbitalPeriod": "Orbital period", "orbitalPeriod@simple": "Time for one lap"`.
- Lookup falls back along the locale chain (`de-CH` -> `de` -> `en`) and, within a locale, from the level variant
  to the plain text; the language wins over the level (German standard text before English simple text).
- Grammar that differs per language gets its data as arguments: e.g. `{parentId, select, sun {…} other {…}}` in
  English lets German pick "zur Sonne" / "zum Jupiter". A locale may use only arguments the English message uses
  (in any of its level variants), so English declares such arguments with an `other`-only select.
- `bodies.json`: per body `name`, `tagline`, `description`, `facts[]`, `comparisons[]`; each text field is either
  one value for all levels or `{ "simple": …, "standard": …, "advanced": … }` (the default level required). Plain text,
  not ICU. The Sun and the eight planets have every field at every level in every locale (tested); moons without
  content get a generated description from their data (`bodies.fallback.moonDescription`).
- `src/i18n/locales.test.ts` and `bodies.test.ts` are the contract: every locale has exactly English's keys and
  variants, parses, uses only known arguments and complete plurals, and mirrors English's body content structure.

### Using it (code)

```ts
const { t, number, quantity, dateTimeUTC, significant, locale, readingLevel } =
	useI18n() // "@/i18n"
t("solarSystem.time.now") // MessageKey is typed from src/locales/en/ui.json
t("dictionary.compare.sizeBigger", { count: 1321 }) // plural + number formatted for the locale
quantity(365.256, "day", "long") // "365.3 days" / "365,3 Tage" (Intl units, no strings needed)
const name = useBodyName()
name("earth") // "@/i18n/bodies": "Earth" / "Erde"
const text = useBodyText("mars") // { name, tagline, description, facts, comparisons, authored }
createI18n({ locale: "de", readingLevel: "simple" }) // the same object outside React (tests, pure helpers)
```

Pure helpers take the `I18n` object (or its `chain`) as a parameter rather than calling the hook. `@/i18n/bodies`
is kept out of the `@/i18n` barrel so the eager root chunk does not pull in the body data. `useI18n()` works inside
the R3F `<Canvas>` (fiber 9 bridges context); outside the provider it returns English/standard.

### State, URL and page metadata

- The URL always states both: `?lang=de&reading=simple` on every route (root `validateSearch`,
  `src/i18n/search.ts`); the root route's `retainSearchParams` middleware keeps them on every `Link` and `navigate`,
  so feature code never passes them. A missing or unknown value is replaced at once (`replace: true`): whatever a
  teacher sees, the address bar reproduces for the class.
- Resolution: URL > the viewer's saved choice (localStorage `astrolabe.locale` / `astrolabe.readingLevel`, written only by the
  switcher) > `navigator.languages` (locale only) > config defaults. Numbers and dates use the browser's regional
  variant of the same language (`de` text, `de-CH` formatting: 149’598’261), never another language's rules.
- `LanguageMenu` (`placement="corner"` on pages without a HUD) switches both. `I18nProvider` sets `<html lang>`, the
  title, the description and application-name metas, and swaps the manifest link for a localized copy of
  `public/manifest.json` (data: URL, `start_url` with `?lang=`).

### How to

- **Add a string:** add the key to `src/locales/en/ui.json` (under the feature's namespace), the same key to every
  other locale, then `t("feature.key")`. Run `pnpm test`: `locales.test.ts` lists anything missing.
- **Add a reading-level variant:** add `"key@simple"` (etc.) in every locale.
- **Add a locale** (e.g. French): copy `src/locales/en/` to `src/locales/fr/`, translate both files (`locale.name` is
  the language's own name, "Français"), run `pnpm test`. No code changes; the switcher lists it automatically.
  A regional variant (`de-CH`, e.g. for ss instead of ß) may be a folder with only the keys that differ once the tests
  allow partial overlays (today every locale must be complete).
- **Add a reading level:** add its id to `config.json` `readingLevels`, its name and description under
  `i18n.readingLevel.<id>` in every `ui.json`, and its texts in the Sun/planet entries of every `bodies.json`.
- **Add body content:** add fields under the body id in every locale's `bodies.json`.
