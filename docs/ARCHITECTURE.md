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
src/store/                   sim.ts, navigation.ts, scale.ts, simSearch.ts (URL schema), urlSync.ts
src/features/                hero/, solarDictionary/, solarSystem/ (index.tsx, scene/, bodies/, camera/, ui/)
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
- Corrections to the source (typos, planet J2000 elements from JPL/Standish, the Moon and Galileans' elements) are made
  in `data/ourDB.json` itself. Sanity checks (Kepler period, density) warn on stderr.

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
- Rotation (`rotation.ts`): `spinAxis` (IAU pole, else the orbit normal tilted by `axialTiltDeg`), `equatorNode` (zero
  of the prime meridian) and `rotationAngle(rotation, jd)` (unwrapped, sign from the period). A mesh is oriented with
  X = equatorNode, Y = spinAxis, Z = X x Y, then rotated about Y.
- Per-frame callers build the index once (`buildIndex`) and pass reused `out` arrays: the frame loop allocates nothing.
- Accuracy: planets within 0.2 deg / 0.15 % of astronomy-engine over J2000 +- 2000 d (`positions.test.ts`); the Moon
  and Galileans within a few degrees; everything else has fictitious phases.

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
| `bigPlanets`        | 0.5      | 1, 1, 1                         | 3, 0.2, 2                      | enlarged bodies at real distances: still lost in space   |
| `everythingVisible` | 0.5      | 1, 0.52, 1                      | 3, 0.2, 2                      | **the default**: small bodies enlarged, orbits pulled in |

`scale.test.ts` guards the non-true presets (orbit order kept, moon systems separated, rings and ring moons true to
proportion). `interpolateScale` blends presets for animated changes; also `presetOf`, `sameScale`, `isValidScale`,
`sizeExaggeration`, `distanceFactor`. `scene/ScaleSync.tsx` pushes the store into the SimFrame and sets
`data-scale-preset` on the canvas (`custom` mid-switch). On a scale change the camera keeps the framed body's
on-screen size (in the overview: the whole drawn planetary system).

### Scale presets, the experience (#21)

- **The grid** (`src/sim/scaleLies.ts`): sizes and distances are separate lies. Every preset is one cell of
  sizes `true | enlarged` x distances `true | squeezed` (`SCALE_LIES`, `presetForLies`): `trueScale` (true/true),
  `textbook` (true/squeezed), `bigPlanets` (enlarged/true), `everythingVisible` (enlarged/squeezed). The squeeze is
  tuned to the sizes, so the grid names presets rather than mixing factors. `bodyDistortion` gives drawn over
  true size and distance from the parent, in kilometres: the numbers the honesty statement shows.
- **The store** (`useScaleStore`): `scale`, `presetId` (null mid-switch or for a console mix), `targetId` (the
  preset the user chose, from the click on), `transition`. `switchTo(id, nowMs, durationMs = SCALE_TRANSITION_MS)`
  animates from whatever is on screen (a switch can turn around mid-way), `setPreset` jumps (links, reduced
  motion), `stepTransition(nowMs)` eases (`easeInOutSine`, 2.5 s) and lands on the preset's frozen object.
  `scene/ScaleTransition.tsx` steps it in `useFrame` at priority -2, before SimClock and the camera director.
- **The panel** (`ui/ScalePanel.tsx`, top right under the layer switches): the three named presets, the Sizes and
  Distances switches (the only way to `bigPlanets`), the preset's one-line summary ("Not to scale!") and the
  honesty statement (`ui/scaleStatement.ts`): two sentences about the selected body, else the focus, else Earth
  ("Earth is drawn 10x too big." / "... 13x too close to the Sun."), factors rounded to two significant digits,
  within 5 % of 1 said as "real". Every string has simple/standard/advanced variants in every locale; German picks
  articles and cases by `subjectId`/`parentId` selects. In `trueScale`/`bigPlanets` a line points at the markers.
- **URL, not storage:** `?scale=<preset id>` (absent = the default, unknown ids ignored), written at the click;
  a link opens in its preset without animating. Nothing is kept in localStorage: every fresh visit starts in
  Everything visible, so the switch to true scale stays the lesson.
- **True scale's navigation aid** is the marker layer (a dot for every body, on by default) plus labels, the focus
  picker and the overview button; there is no extra "find Earth" widget.

## Navigation (`src/store/navigation.ts`, `features/solarSystem/camera`; #10)

The camera director is the only code that touches the camera, controls or render origin; features ask the store for a
view (an ESLint rule keeps drei camera controls inside `camera/`). The navigation slice lives in `useSimStore`:

```
selectedId: string | null   drives info panels, labels, the URL; never moves the camera
view: View                  { kind: "overview" } | { kind: "body", id } | { kind: "point", anchorId, offsetKm }
focusId: string             body the view is centred on (the Sun for the overview, a point's anchor)
shot: CameraShot | null     { azimuthDeg, elevationDeg, distance } at rest; distance is a multiple of the default framing
transition, sequence        the running move and the running tour
viewMode(state)             "overview" | "focused" | "free" | "transit"
```

Actions: `select`, `setFocus` (click: select + focus), `focus`, `overview`, `goTo(view, request?)`, `jumpTo`, `reset`
(the way out), `skip`, and sequences (`playSequence`, `goToStep`, `nextStep`, `resumeSequence`, `stopSequence`). A
request carries a partial `shot`, `durationMs` and a `profile`. Invalid views and unknown bodies are ignored.

Director (`camera/director.ts`, unit-tested frame by frame):

- Every request starts a new move from wherever the camera is, so retargeting mid-flight never snaps back. Both pivots
  and the arrival distance are re-read every frame.
- User input during a move takes over distance and direction while the pivot still glides home; it also interrupts
  automatic sequence steps. A pan while settled becomes a `point` view.
- A non-finite camera or a view of a missing body resets to the overview.
- Profiles (`camera/profiles.ts`): the default `smooth` is van Wijk and Nuij's zoom-and-pan (`camera/pose.ts`), 0.8–3 s.
- `window.__astrolabe` (`camera/debugHandle.ts`) exposes `camera()` (`director.snapshot()`) and the store for the
  console and e2e tests. Read the camera, never write it.

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
WARP_PRESETS                                      1x, 1 min/s, 1 h/s, 1 day/s, 1 week/s, 1 month/s, 1 year/s
```

Anything positioned in time is a pure function of a JD, never of frames. In `useFrame` read `useSimStore.getState()`;
React UI subscribes with selectors, and reads the clock only through `useThrottledSimTime()` (10 Hz).

URL: `/solar_system?focus=io&sel=europa&cam=<az_el_dist>&t=<jd>&warp=<n>&moons=false&scale=trueScale` (`scale`: see
Scale presets). The layer switches `orbits`,
`labels`, `moons`, `markers` (`LAYER_PARAMS` in `urlSync.ts`) are written as `=false` while off. Defaults (overview,
home shot `0_45_1`, `warp=1`, a switch that is on) are left out; a link without a switch turns it on. `simSearch.ts` drops invalid or blank values (never coerces them to 0). `useSimUrlSync()` runs
once, in `<UrlSync />` rendered before `<Scene />`: it seeds the store before the Canvas mounts (no `t` means the wall
clock at mount), then writes back with `replace: true`, `t` at most once per second and only while paused or at
|warp| <= 60.

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
  `#0b0d12`. A decay-0 PointLight in the Sun plus 0.05 ambient; the Sun is unlit (`toneMapped={false}`). Bloom arrives
  in Phase 6.
- Bodies (`bodies/BodyMesh.tsx`): a group per body, scaling one of three shared unit spheres (64/32/16 segments for
  Sun and planets / moons / estimated moons) by the drawn radius; lazy sRGB textures behind a per-body Suspense.
- Rings: radial UVs, `alphaMap` = alpha strip (linear, gray level = opacity; never use it as `map`), `map` = color strip
  (sRGB), clamped, double-sided. Brighten dark generated rings in the material, not the data.
- Orbit lines (`bodies/OrbitLine.tsx`): 256 samples plus one anchor vertex written from the body's own position, so the
  line always passes through its body. Rebuilt on scale or large origin/parent moves; otherwise only the anchor updates.
  Use `LineBasicMaterial` on a raw `<threeLine>` registered with `extend({ ThreeLine: Line })` (without it any re-render
  throws). Not drei `<Line>`: it lacks logdepth and depth-fights. Headless SwiftShader drops the focused orbit in
  close-ups; not an app bug.
- Markers: one `Points` layer (4 px round dots, no depth test) so nothing vanishes at true scale; a dot hides once its
  body is wider than 6 px, and moon dots show only within the focused family (`isMoonDotShown`). Picking is angular
  (10 px), planets win over moons. `showMarkers` off hides and unpicks them.
- Interaction: click calls `setFocus`, hover sets `hoverId`; a tap selects, a drag (`scene/tap.ts`) does not.
  `scene/HoverCursor.tsx` shows a pointer over click targets (`isClickTarget`: any body but the focus once it is also
  selected, which fills the view up close). Labels: planets always, moons only within the focused family.
- Camera (`camera/framing.ts`, `camera/input.ts`): `minDistance = max(1.2 R, R + 2 near)` of the drawn radius, bodies
  framed from 6 radii, the overview fits the drawn planetary system x 1.3 from azimuth 0 / elevation 45. Orbit with
  left button or one finger; dolly with wheel, pinch (ctrl+wheel via `pinchAsDolly`) or middle button. Panning is behind
  `PAN_ENABLED` until #15.
- Visibility: `isBodyShown(body, state)` is the one rule for meshes, orbits and markers; hiding moons never hides the focus.
- HUD (`ui/`, plain React over the Canvas, selectors only, never the SimFrame): `TimeControls`, `SceneToggles`,
  `FocusPicker`, `OverviewButton`, `BodyInfo` (hidden below 600 px; shows the body's tagline), `LanguageMenu` (in the
  toggles panel), `ScalePanel` (below the toggles panel). Escape and the overview button call `reset()`. The clock shows the locale's date format inside
  `<time dateTime="2026-09-24T10:35Z">`; warp labels come from the value (`ui/warp.ts` `warpParts`), not
  `WARP_PRESETS[].label`.
  Keys (ignored in fields and with modifiers): Space pause, `+`/`-` warp presets, ArrowLeft/Right cycle siblings.
- Page (`index.tsx`): `<UrlSync />`, then `scene/Scene.tsx` (Canvas + `SimFrameContext.Provider`, `ScaleSync`,
  `ScaleTransition`, `SimClock`, `HoverCursor`, lights, `Bodies`, `OrbitLines`, `Markers`, `CameraRig`, later `Effects`) and the HUD.

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
