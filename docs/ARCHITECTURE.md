# Astrolabe architecture (rebuild, September 2026)

A true-scale, interactive 3D model of the solar system (Sun, planets, moons) plus the visual dictionary and hero page,
shipped as a client-only static site. This is the shared contract for humans and agents working on the rebuild: follow
it, and if it must change, change it in the same change set.

## Stack

- Vite + React 19 + TypeScript (strict), pnpm, Node 22 (`.nvmrc`).
- TanStack Router, file routes in `src/routes`. URLs stay `/`, `/solar_dictionary`, `/solar_system`, plus `/solar_walk` (#25). Search params are
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
data/rings/<planet>.json     ring systems the source lacks or gets wrong (Jupiter, Uranus, Neptune)
scripts/build-bodies.ts      data/ -> src/data/bodies.json (pnpm build:data); the pure, tested mapping lives in scripts/lib/
scripts/gen-ring-textures.ts data/rings -> public/assets/textures/<planet>/rings/ (pnpm gen:rings)
data/spacecraft.json         curated spacecraft catalogue (#35); scripts/build-spacecraft.ts + JPL Horizons -> src/data/spacecraft*.json (pnpm build:spacecraft)
src/routes/                  file routes; src/routeTree.gen.ts is generated and committed
src/providers/               Mantine theme, I18nProvider, GSAP transition context, Layout
src/i18n/                    languages and reading levels (see i18n); body content in bodies.ts ("@/i18n/bodies")
src/locales/                 translation resources: config.json, <locale>/ui.json, <locale>/bodies.json
src/data/                    bodies.json, schema.ts (zod), index.ts (lookups), solarDictionary.ts (dictionary + hero adapter)
src/sim/                     pure simulation, no React or three objects (import from "@/sim"); testing/ is test-only
src/store/                   sim.ts, navigation.ts, scale.ts, lighting.ts, spin.ts, trails.ts, light.ts, simSearch.ts (URL schema), urlSync.ts
src/features/                hero/, solarDictionary/, solarSystem/ (index.tsx, scene/, bodies/, camera/, frame/, labels/, lighting/, light/, rings/, ui/),
                             solarWalk/ (the basketball solar system, #25)
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
		synchronous?: true // tidally locked: the prime meridian faces the parent
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
- IAU poles and prime meridians (WGCCRE 2015 at J2000) for the Sun, planets and Moon come from `scripts/lib/iau.ts`,
  with Mars's and Neptune's periodic terms evaluated at J2000 (the constant terms alone put Mars's pole 1.5 deg off).
  Their periods come from the IAU rate W1, not the source's rounded ones (Earth 23.9345 h drifts 4 deg by 2026).
- Tidal locking (`synchronousRotation`): a moon whose period matches its orbit is `synchronous`; a regular moon
  (inside the Laplace radius) without a period is assumed locked with its orbital period (`info.rotationAssumed`).
  Irregular moons without a period and Hyperion (`rotationChaotic` in the source: it tumbles) keep `null`: no spin.
- Moon inclinations refer to the Laplace plane: inside the planet's Laplace radius they are rotated from the planet's
  equator into the ecliptic (`frames.ts`), so regular moons and rings are coplanar; outside it they are kept as ecliptic.
- Rings: Saturn from the source; Jupiter, Uranus and Neptune from `data/rings/` (`EXTERNAL_RING_PLANETS`; the source's
  Jupiter ring was an opaque Saturn-like texture, replaced by the halo, main and Amalthea gossamer rings). Strips run
  u = 0 (inner) to u = 1 (outer), gray level = face-on opacity. Every ring lies within 3 planet radii (the moon curve's
  knee, so rings stay true to their planet in every preset; Jupiter's Thebe gossamer ring, out to 3.2, is left out).
  A missing ring texture fails the build.
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
  of the prime meridian), `rotationAngle(rotation, jd)` (unwrapped, sign from the period) and `synchronousAngle` (the
  angle that turns the prime meridian toward a direction). Spin speed is `spin.ts`; see Rotation below.
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

### The basketball solar system (`src/features/solarWalk`, route `/solar_walk`; #25)

True scale taken out onto the school field: "if the Sun were a basketball, Earth is a pinhead 26 m away".

- **Not a second model.** `walk.ts` (pure) measures #21's true scale with a new ruler: every length is what
  the engine draws under `TRUE_SCALE` (`bodyDistortion`), times one factor that makes the Sun's diameter the
  chosen object's (`SUN_OBJECTS`: orange 8 cm, football 22 cm, basketball 24 cm (default), exercise ball 1 m).
  `walk.test.ts` checks it against published values (Earth 2.2 mm at 25.8 m, Neptune 776 m, 1 AU = 107.5 Sun
  diameters, the nearest star 6,900 km) and that every model length is the true km times the same factor.
- **Stops:** the Sun at the start, the planets by mean distance (semi-major axis) with the leg from the previous
  stop, their big moons (radius >= 1000 km: the Moon, the Galileans, Titan, Triton) and the nearest star (Proxima
  Centauri, `NEAREST_STAR`; not a body of the app). Sizes are compared with the nearest everyday thing on a log
  scale (`THINGS`: typical diameters from a grain of fine sand to a football, never off by more than 1.5x).
- **Landmarks** (`LANDMARKS`: football pitch 105 m, running-track lap 400 m): distances in landmark lengths and a
  marker where the first one ends. Teachers pick names, never type numbers.
- **Text:** `walkText.ts` builds every sentence from `I18n` (tested in en/de at each level); lengths through
  `lengths.ts` (`formatLength`: mm/cm/m/km, two significant digits below 10, whole numbers up to 999,
  "149.6 million km" for true values, "1 : 5.8 billion" for the scale).
- **Views:** the walk (a path of stop cards, the default) and a table (projectable). Printing always prints the
  table: controls hidden, black on white, a tick column, bodies up to 30 mm drawn at their model size in CSS mm.
- **URL:** `?sun=<object>&landmark=pitch|track|none&view=walk|table` (`search.ts`, zod only, so the route chunk
  stays light); defaults are left out.
- **Links with the 3D model:** the Scale panel shows "Walk it" in True scale; every stop opens
  `/solar_system?scale=trueScale&focus=<id>`. The hero page has a button.

## Navigation (`src/store/navigation.ts`, `features/solarSystem/camera`; #10)

The camera director is the only code that touches the camera, controls or render origin; features ask the store for a
view (an ESLint rule keeps drei camera controls inside `camera/`). The navigation slice lives in `useSimStore`:

```
selectedId: string | null   drives info panels, labels, the URL; never moves the camera
view: View                  { kind: "overview" } | { kind: "body", id } | { kind: "point", anchorId, offsetKm }
                            (a point: offsetKm is TRUE km from the anchor, drawn through the scale engine; #15)
focusId: string             body the view is centred on (the Sun for the overview, a point's anchor)
frameId: string             body the reference frame holds still (#31): the Sun (Sun-centred) or focusId
shot: CameraShot | null     { azimuthDeg, elevationDeg, distance } at rest; distance is a multiple of the default framing
transition, sequence        the running move and the running tour
panning: boolean            a pan (or its damped glide) is moving the pivot right now
viewMode(state)             "overview" | "focused" | "free" | "transit"
```

Actions: `select`, `setFocus` (click: select + focus), `focus`, `overview`, `goTo(view, request?)`, `jumpTo`, `reset`
(the way out), `skip`, `anchorFrame(id, request?)` / `releaseFrame()` (#31), and sequences (`playSequence`, `goToStep`,
`nextStep`, `resumeSequence`, `stopSequence`). A request carries a partial `shot`, `durationMs`, a `profile` and a
`fit` region (`{ km, around }`: frame a sphere of `km` TRUE km around the centre, drawn as a distance from body
`around` is; overrides the shot's distance). Invalid views and unknown bodies are ignored.
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

### Anchored reference frame (`src/sim/referenceFrame.ts`, `features/solarSystem/frame/`; #31)

"Hold Earth still": everything is drawn relative to a body, which stays fixed on screen, and the planets' paths
become the sky's motions (the Sun's yearly circle, Mercury's and Venus's flowers, Mars's retrograde loop).

- **Model.** `frameId` in the navigation slice: the Sun (Sun-centred, the default) or the focus. An anchored frame
  follows the focus (centring Mars holds Mars still); the overview, `reset()` (home button, Escape) and
  `releaseFrame()` return to the Sun. `anchorFrame(id, request)` anchors and centres on `id` (a point already near it
  stays). The frame is non-rotating: its axes stay fixed to the stars, like the sky.
- **Drawing (re-rooting).** The scale engine keeps directions true only from parent to child, so an anchored frame
  re-roots the one rule at the anchor's top-level body P (the root's child it belongs to; a moon's planet): P stays
  where it is drawn, every other top-level body goes to `P + framedOffset(true(body) - true(P))` (`orbitDistance`
  in root radii), moons ride along. Every direction seen from P is its true sky direction in every preset; the Sun
  lands exactly where it was; at true scale nothing changes. `applyReferenceFrame` runs inside `updateSimFrame` /
  `setSimFrameScale` from `SimFrame.frameBlend` (anchors + weights), so everything drawn (meshes, markers, labels,
  framing) follows without knowing about frames. Lighting stays in true km, unaffected.
- **Blend.** `frame/ReferenceFrameSync.tsx` (useFrame -1.5, before SimClock) eases `frameBlend` to the store's frame
  over `FRAME_BLEND_MS` (1.2 s, cross-fading two anchors); the first frame lands at once (deep links).
  `anchoredWeight` / `anchorWeight` read it: orbit lines around the Sun (and their names) fade out as it rises.
- **Camera.** Through the director only: a `fit` request frames the preset's region; a pan while anchored lands back
  on the body held still or becomes a point anchored to it (never a new frame, never the Sun's neighbourhood).
- **Clicks** (#16's `scene/picking.ts`): while a body is held still, a click on another body selects it
  (`bodyClickAction` "select": its trail brightens, the badge reads its motion) instead of flying there, and a click
  on empty space only deselects; the picker and "Hold ... still" move the frame on purpose, the badge, the home button
  and Escape leave it.
- **Trails** (`frame/trails.ts`, `frame/Trails.tsx`): one line per top-level body (the Sun and the planets) but P,
  relative to P, as a pure function of time: the window `trailWindow(jd, sinceJD)` (the last `TRAIL_LENGTH_DAYS`,
  two years; from `sinceJD` after "Restart the trails", `src/store/trails.ts`) sampled on whole Julian days plus the
  exact current position as the head. Slid incrementally, recomputed after a jump; runs backwards; the tail fades,
  the selected or hovered body's trail is brighter. Samples are TRUE offsets drawn with `framedOffset`.
- **HUD.** `frame/FrameMenu.tsx` in the picker panel always names the frame ("Sun-centred", "Seen from Earth") and
  offers the presets (`frame/presets.ts`: Sun-centred; Seen from Earth: the planets = Earth, Mars selected, top-down
  fit of 2.7 AU, 1 month/s; Seen from Earth: the Moon = Earth, Moon selected, Moon's orbit, 1 day/s) and "Hold
  <focus> still". `frame/FrameBadge.tsx` (top centre while anchored) names the frame, explains it, reads the sky
  from the anchor (`frame/sky.ts`: forwards / stationary / retrograde from the ecliptic longitude rate, or the phase
  of a body of the same family) beside a map of the same moment from above the Sun (`frame/inset.ts`, true
  proportions, line of sight) or the phase disc, and holds "Back to Sun-centred" and "Restart the trails".
  Strings: `solarSystem.frame.*`.

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
- Building on it: anything lit by the Sun (#23, #35) includes `SUNLIGHT_PARS`, shares its body's uniforms and calls
  `sunVisibility(p)` with `p` in that body's true frame (centre at origin, true km); `sunlightCasterVisibility(p, caster)`
  adds one caster of its own (the rings use it for the planet). Rings are the worked example (see Rings).

## Rotation (`src/sim/rotation.ts`, `src/sim/spin.ts`, `bodies/orientation.ts`, `src/store/spin.ts`; #13)

`bodies/orientation.ts` is the one authority on how a body is oriented; nothing else builds a body's frame.

- Pole frame (`bodyOrientation(body)`, constant): +X = `equatorNode`, +Y = `spinAxis` (the IAU north pole, so north-up
  maps stay upright and Uranus lies on its side with its north pole 82 deg from the ecliptic pole), +Z = X x Y. Its
  XZ plane is the equator. BodyMesh's `<group>` carries it; the textured mesh inside is the only thing that spins.
  Anything that follows the tilt but not the spin (#12 rings, an equator line) is a child of that group or applies the
  same quaternion. In the pure/shader world the pole is `spinAxis()` in scene axes (e.g. for ring shadows).
- Spin (`bodySpinAngle(body, createBodySpin(body, i, frame), frame)`): an angle about local +Y, positive = prograde.
  Normally `rotationAngle(rotation, frame.spinJD)`. A `synchronous` body instead turns its prime meridian toward its
  parent from the TRUE positions each frame (exact, eccentric orbits and the Moon's precession included), in every
  spin mode. `bodySurfaceOrientation(pole, angle)` composes both for surface-fixed things (a city, a landing site).
- Texture alignment: three's SphereGeometry puts u = 0.5 (longitude 0) on local +X, east on -Z, north on +Y; with the
  IAU W0 and the W1-derived periods the noon Sun is over Greenwich at 12:00 UTC, and the tilt gives the subsolar
  latitude of the seasons (+-23.44 deg at Earth's solstices; `orientation.test.ts`).
- Spin speed: all non-synchronous spin reads one spin time, `frame.spinJD`, written by `scene/SpinClock.tsx`
  (priority -0.9, after SimClock) from `advanceSpinClock`. It follows the simulation clock (pause stops it, reverse
  reverses it). Named modes (`SPIN_MODES`, `useSpinStore`; `ui/SpinControl.tsx` under the time controls):
  `realistic` (default: spinJD = simTimeJD, the true orientation for the date), `slowed` / `slow` (the spin rate is
  capped so one Earth turn takes at least 4 s / 30 s of real time; below the cap it is the true rate; every body is
  slowed by the same factor, so Jupiter stays 2.4x Earth and Venus stays backwards), `stopped`. The cap is applied to
  the frame's step, so it is frame-rate independent and a date jump turns bodies by at most one frame's worth. In a
  capped mode spinJD falls behind and day/night no longer match the date; the HUD says so, and `realistic` snaps back.
  Time warp and spin are therefore independent: warp sets orbital speed, the spin mode only ever slows spin down.
- The mode is not persisted or in the URL (like "Always lit"): every visit opens with the true spin. The canvas
  carries `data-spin-mode`.

## Rings (`src/sim/rings.ts`, `features/solarSystem/rings/`, `lighting/ring*.ts`; #12)

Driven by data alone: a body with `rings` gets them (Jupiter, Saturn, Uranus, Neptune), nobody else does.

- Placement: `rings/Rings.tsx` is a child of BodyMesh's pole-frame group (see Rotation), so the rings lie in the
  equator and follow the tilt, never the spin (Uranus's stand almost on edge to the ecliptic). The annulus is built in
  planet radii (`createRingGeometry`, 256 segments, outer polygon circumscribed, both edges cut exactly by radius in
  the shader) and scaled every frame by `frame.renderRadius(i)` like the sphere: `displayBodyLengthKm`, true
  proportion to the planet in every preset, never detached.
- Textures (`rings/ringTextures.ts`): the two strips are read once per ring system (`loadRingTextures`, cached, React
  `use`) and baked into 1-texel-high textures with hand-built mip chains: `color` = opacity-weighted mean colour (sRGB)
  - mean opacity in A; `peak` = the highest opacity over the footprint. The shader draws `max(mean, 0.6 * peak)`, so a
    ring a few km wide (Uranus's) stays a faint line at any zoom instead of averaging away.
- Optics (`src/sim/rings.ts`, ported to GLSL in `lighting/ringPars.ts`; keep in step): opacity is face-on; crossed at
  cosine `mu` to the pole it is `1 - (1 - opacity)^(1/mu)` (`slantOpacity`, mu >= 0.02). So a ring seen nearly edge-on
  is a dense bright line. Exactly edge-on the sheet covers no pixel: a rim at the outer radius (`RING_EDGE`, an open
  cylinder extruded `RING_EDGE_PX` = 1.5 px along the pole in the vertex shader, needs `uViewportHeight`) draws the
  line with the whole system's mean opacity and fades out once |cos| > `RING_EDGE_FADE` (0.03).
- Depth: the rings write no depth and sit `RING_DEPTH_BIAS` behind their plane in the log depth buffer, so the orbit
  lines of ring moons (coplanar) draw over them instead of dashing through.
- Lighting (`lighting/ringShader.ts`, `ringMaterial.ts`): the ring material spreads the PLANET's sunlight uniforms (the
  same objects) and adds its strips; transparent, `depthWrite` off, double-sided. A ring point is `p` = the local point x
  `radiusKm / drawnRadius` in scene axes; it gets `sunVisibility(p)` (the planet's moons) x the planet as a caster at
  the origin: the planet's shadow on the rings. The lit face is `RING_BRIGHTNESS`, dimmed toward `RING_GRAZING_LIGHT`
  as the Sun reaches the ring plane (equinox); the unlit face lets light through thin rings and stays dark behind
  dense ones (`RING_BACKLIT_DENSE`). Dark rings are brightened in the shader to `RING_MIN_LUMINANCE`, never in the data.
  "Always lit": lit from the viewer, no shadows.
- The rings' shadow on the planet: `createSunlitMaterial({ ringShadow })` sets `USE_RING_SHADOW`; the body shader
  intersects the ray from the surface point toward the Sun with the ring plane (the pole is the sphere's local +Y,
  which the spin leaves alone) and multiplies the sunlight by the slant transmittance of the mean opacity there
  (`ringShadowTransmittance`). Ringless bodies compile none of it.
- Picking: the ring sheet is a real scene target, nearer than `BodyPicking`'s "empty space": a click on the rings is
  `activateBody(planet)` and hovering them hovers the planet, so a click on Saturn's rings never resets the view.

## Floating origin

GPU positions are float32, so the render origin is the camera's pivot in display space:
`renderPos(b) = toUnits(display(b) - origin)`, computed in doubles every frame. The controls always target (0, 0, 0).
The canvas uses a logarithmic depth buffer. Orbit lines are rebuilt relative to the origin when it moves, so nothing
near the camera jitters.

## Store (`src/store/sim.ts`)

```
simTimeJD, timeWarp, paused, clock, lastTickMs    time; change only through the actions below
hoverId, showOrbits, showLabels, showMoons, showMarkers, showOrbitLabels
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

URL: `/solar_system?focus=io&sel=europa&cam=<az_el_dist>&t=<jd>&warp=<n>&moons=false&scale=trueScale` (`scale`: see
Scale presets). The layer switches `orbits`,
`labels`, `moons`, `markers` (`LAYER_PARAMS` in `urlSync.ts`) are written as `=false` while off; the orbit names,
off by default, as `orbitNames=true` while on; `frame=<id>` while a body is held still (#31). Defaults (overview, home shot `0_45_1`, `warp=1`, a switch that is on)
are left out; a link without a switch turns it on. `simSearch.ts` drops invalid or blank values (never coerces them to
0). `useSimUrlSync()` runs once, in `<UrlSync />` rendered before `<Scene />`: it seeds the store before the Canvas
mounts (no `t` means the wall clock at mount), then writes back with `replace: true`, `t` at most once per second and
only while paused or at |warp| <= 60, and never while a birth date is entered (#26, see Birthday).
`?birthday=true` opens the birthday panel.

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
	spinJD: number // spin time (see Rotation); written by SpinClock only
	scale: ScaleSettings // change with setSimFrameScale only
	scaleVersion: number // bumps on scale change; cache scale-derived geometry on it
	frameBlend: FrameBlend // anchored reference frames and their weights (#31), written by ReferenceFrameSync
	topIndex: Int32Array // top-level body (the root's child) of every body
	renderPosition(i: number, out: Vector3): Vector3
	renderPositionOf(id: string, out: Vector3): Vector3
	renderRadius(i: number): number
}
export function createSimFrame(bodies: readonly Body[], jd?: number, scale?: ScaleSettings): SimFrame
export function updateSimFrame(frame: SimFrame, jd: number, originIndex?: number): void
export function setSimFrameScale(frame: SimFrame, scale: ScaleSettings): void
export const useSimFrame = (): SimFrame // throws outside the provider
```

- Frame order: `SimClock` (`useFrame` priority -1) ticks the store and updates the SimFrame, `SpinClock` (-0.9) writes
  `spinJD`; the camera director
  (-0.5) writes the origin and the camera; everything else draws at the default priority and only reads.
- Per-frame writes live in exported plain functions taking the objects they mutate (`updateSimFrame`,
  `updateOrbitBuffers`, `fillMarkers`) to satisfy `react-hooks/immutability` without `eslint-disable`. No allocations
  in the frame loop.
- Canvas: `dpr={[1, 2]}`, logarithmic depth buffer, near 1e-5, far 1e9, fov 45 (`camera/framing.ts`), background
  `#0b0d12`. No three.js lights (see Lighting); the Sun is unlit (`toneMapped={false}`). Bloom arrives in Phase 6.
- Bodies (`bodies/BodyMesh.tsx`): a group per body (the pole frame, see Rotation), scaling one of three shared unit spheres (64/32/16 segments for
  Sun and planets / moons / estimated moons) by the drawn radius; lazy sRGB textures behind a per-body Suspense; every
  body but the Sun uses the sunlit material (see Lighting).
- Rings: see Rings. A child of the body's pole-frame group, sharing its sunlight uniforms.
- Orbit lines (`bodies/OrbitLine.tsx`): 256 samples plus one anchor vertex written from the body's own position, so the
  line always passes through its body. Rebuilt on scale or large origin/parent moves; otherwise only the anchor updates.
  Use `LineBasicMaterial` on a raw `<threeLine>` registered with `extend({ ThreeLine: Line })` (without it any re-render
  throws). Not drei `<Line>`: it lacks logdepth and depth-fights. Headless SwiftShader drops the focused orbit in
  close-ups; not an app bug.
- Markers: one `Points` layer (4 px round dots, no depth test) so nothing vanishes at true scale; a dot hides once its
  body is wider than 6 px, and moon dots show only within the focused family (`isMoonDotShown`). The dots are drawn
  only; picking is `BodyPicking`'s (see Picking). Labels join the same picking (see Labels).
- Camera (`camera/framing.ts`, `camera/input.ts`): `minDistance = max(1.2 R, R + 2 near)` of the drawn radius, bodies
  framed from 6 radii, the overview fits the drawn planetary system x 1.3 from azimuth 0 / elevation 45. Orbit with
  left button or one finger; dolly with wheel, pinch (ctrl+wheel via `pinchAsDolly`) or middle button; pan with the right
  button, Shift + left, two or three fingers (see Re-centring). A point's zoom limits are its anchor's.
- Visibility: `isBodyShown(body, state)` is the one rule for meshes, orbits and markers; hiding moons never hides the focus.
- HUD (`ui/`, plain React over the Canvas, selectors only, never the SimFrame): `TimeControls` (with `SpinControl` below it), `SceneToggles`,
  `FocusPicker`, `OverviewButton`, `BodyInfo` (the focused view's card, see Picking), `LanguageMenu` (in the
  toggles panel), `CentreBadge` and `CentreMarker` (#15), `ScalePanel` (#21, below the toggles panel). Escape, the overview button, the card's close button and a click on empty space call `reset()`. The clock shows the locale's date format inside
  `<time dateTime="2026-09-24T10:35Z">`; warp labels come from the value (`ui/warp.ts` `warpParts`).
  Keys (ignored in fields and with modifiers): Space pause, `+`/`-` next faster/slower preset (direction kept),
  ArrowLeft/Right cycle siblings.
- Page (`index.tsx`): `<UrlSync />`, then `scene/Scene.tsx` (Canvas + `SimFrameContext.Provider`, `ScaleSync`,
  `ScaleTransition`, `ReferenceFrameSync`, `SimClock`, `SpinClock`, `HoverCursor`, `Bodies`, `OrbitLines`, `Trails`, `Markers`, `Labels`, `BodyPicking`, `CameraRig`,
  `HighlightTracker`, later `Effects`; then the `LabelLayer` beside the Canvas), `ui/BodyHighlight`, and the HUD.

## Picking: click a body to focus on it (`scene/picking.ts`, `scene/BodyPicking.tsx`; #16)

One invisible object (`BodyPicking`, a `<group>` with its own `raycast`) is the scene's only click and hover target;
meshes and marker dots have no handlers. Its raycast asks `pickBody` (pure, unit-tested) and always reports a hit: a
body, or "empty space" at `CAMERA_FAR`, so other clickable scene objects (nearer) still win and stop propagation. The
labels' own picking (#20) reports its hits at distance 0, so a label beats the body picker; a label tap goes through
`<Labels onActivate={activateBody}>`, the same action as a tap on the body, and a hovered label sets `hoverId`, so the
hover ring, name and cursor apply to labels too.

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
  planet fit into the gap, the year in Earth years or laps per Earth year, the spin (#13's rotation period and tidal-lock note), weight relative to Earth; the exact
  number sits under each. In the overview or a free view the card is a hint that planets can be clicked. On phones
  (< 600 px) the card sits above the time controls with its facts folded behind a toggle.
- `window.__astrolabe.screenOf(id)` gives a body's screen position and drawn radius, and `.scale` the scale store, for
  the console and e2e tests.
- Building on it: #17 moons (focus is how they are seen), #18 fly (clicks call `setFocus`; a fly profile can be
  requested through `focus(id, request)`), #24 compare (the card's action
  row takes "Compare with…"), #28/#29/#34 (select or focus through the store).

## Labels (`features/solarSystem/labels`; #20)

Names are DOM text over the Canvas (crisp, translated through `@/i18n/bodies`, styled in `Labels.module.css`), laid
out in screen space every frame. Three parts share one `LabelBoard` created in `Scene.tsx`:

```
layout.ts      pure: candidates, priority, placement, fading, picking (LabelLayout: typed arrays per slot)
project.ts     per frame: projects SimFrame drawn positions/radii through the camera, eligibility, then placeLabels
orbitAnchor.ts where an orbit's name goes (the orbit line's own samples, leftmost point on screen)
Labels.tsx     in the Canvas: the useFrame loop (layout, fade, write DOM) and the scene-picking hook
LabelLayer.tsx beside the Canvas: one <span data-body> per body (+ <span data-orbit> while orbit names are on)
board.ts       the DOM side: attach, measure (offsetWidth), writeLabels (transform/opacity only when changed)
activate.ts    what a tap on a label does (default: setFocus, the same as a tap on the body)
```

Slots: `0..n-1` are the bodies' names, `n..2n-1` their orbits' names (`orbitSlot`, `slotBody`).

- **Anchor:** `frame.renderPosition(i)` projected, offset by the drawn disc (`frame.renderRadius(i)` as an angular
  radius, at least the 2 px marker dot). Nothing has its own scale factor, so a label stays on its body in every
  preset and through preset changes.
- **Candidates** (`isLabelCandidate`): the Sun and planets always; moons only in the focus family (the marker rule),
  or while hovered/selected; hidden moons never (except the focus).
- **Eligible:** in front of the camera, not behind a nearer larger disc (`isOccluded`), not under a HUD panel
  (`isKeptOut`), and a moon of a planet that is still a dot (<= 24 px radius) at least 10 px clear of it
  (`isClearOfParent`): moons' names fade in as the camera approaches.
- **Priority** (`labelRank`): hovered, selected, focus, then Sun, planets, moons, larger first within each tier.
- **Placement** (`placeLabels`): greedy in priority order; 8 positions round the disc (right, left, below, above,
  diagonals; last frame's side first), never on its own disc, inside the viewport, never over another label or a HUD
  `.panel` (`setKeepOut`, re-read every 0.25 s), first try clear of every dot (<= 24 px), else only of labelled ones.
  No free position: hidden. 2 px hysteresis against flicker; 0.2 s fades (`fadeLabels`).
- **Density:** at most `MOON_LABEL_BUDGET` (8) moon names at once (largest first); the hovered, selected or focused
  moon and moons drawn >= 8 px radius are extra. Orbit names rank after every body name and share the moon budget.
- **Size:** CSS, relative to the viewport (planets 13..19 px, moons 12..16 px, orbits 11..15 px), never the zoom.
  Light text with a dark multi-layer halo for contrast on black space and bright planet faces alike; the Sun
  and moons take their marker colours, the selection is orange, hover underlines.
- **Picking:** the layer is `pointer-events: none` (drags and wheel zooms that start on a label still reach the
  camera). `Labels.tsx` adds a `<group raycast>` that hit-tests the label boxes (`pickLabel`, 3 px slack) and reports
  a hit at distance 0 with `index` = body index, so labels win over what they are drawn over and share the markers'
  hover, cursor and tap (`isTapEvent`) handling. `<Labels onActivate>` is the hook for #16 (`activateBody`).
- **Switches:** `showLabels` (the Labels switch; `setShowLabels(false)` hides every name at once, e.g. for #30/#33),
  `showOrbitLabels` (Orbit names; needs orbits and labels on).
- **For later issues:** `[data-body=<id>][data-visible=true]` marks a shown name (tests, tours); a feature that
  needs a body named can select or hover it (top priority).

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

## Spacecraft (`features/solarSystem/spacecraft`, `src/sim/spacecraft.ts`, `src/data/spacecraft*`; #35)

Ten real missions: Voyager 1 and 2, Pioneer 10 and 11, New Horizons, Cassini, Parker Solar Probe, JWST, Juno,
Europa Clipper. They are not bodies (no mass, radius or orbit elements in `bodies.json`) but points placed through
the scale engine like any other non-body object.

**Data.** `data/spacecraft.json` is the curated source: Horizons id, launch, data range, mission end (`null` while
operating; `silent` = still flying unheard, `destroyed` = gone), events (flybys, orbit insertions, the heliopause...),
forced centres (JWST stays Earth-centred) and orbit phases (drawn as a local track). `pnpm build:spacecraft`
(`scripts/build-spacecraft.ts`, pure parts in `scripts/lib/spacecraft/`, tested) needs the network once; Horizons
responses are cached in `node_modules/.cache/astrolabe-horizons`. It writes:

```
src/data/spacecraft.json              the catalogue (+ flyby times and distances from the data), a few kB, eager
src/data/spacecraftTrajectories.json  craft id -> segments (compact, .prettierignore), ~0.5 MB, loaded on demand
src/data/spacecraftCheck.json         dropped Horizons states with their tolerance, for the unit tests only
```

- Source: NASA/JPL Horizons (https://ssd.jpl.nasa.gov/horizons/), geometric states, ecliptic and equinox of J2000,
  km and km/s, UT time tags; reconstructed from tracking where flown, Horizons' predictions beyond (the
  Voyagers' solution is fitted to tracking up to 1992 and extrapolated since; the Pioneers' likewise).
- Coverage: from launch (the first Horizons state, minutes after lift-off) to Voyager 2099-12-31, Pioneers and
  New Horizons 2049-12-31, Cassini 2017-09-15 (entry into Saturn), Parker 2029-12-31, JWST 2031-09-20, Juno
  2028-09-30, Europa Clipper 2030-04-12 (Jupiter arrival). Outside that range a craft is not drawn and the panel
  says so ("not launched yet", "no data for this date").
- Sampling: daily Sun-centred states; within 1.5 Hill radii of a planet, planet-centred states (hourly); wherever a
  step turns the craft more than 0.2 rad around its centre, denser states down to 1 minute (perijoves, perihelia,
  launches). Samples that cubic Hermite interpolation (`src/sim/hermite.ts`, position and velocity) rebuilds within
  max(1 km, 1e-3 x distance from the centre) are dropped: about 8,000 of 615,000 states are kept.
- Accuracy: the interpolation tolerance above against Horizons (tested with the check points), plus Horizons' own
  uncertainty (arcseconds for the Voyagers today; "historical purposes" quality for the Pioneers). The planets come
  from the app's Kepler model (a few 0.1 deg off JPL), so near a planet the craft is placed relative to the MODEL
  planet: a flyby passes the drawn planet at its true miss distance (Voyager 2: 29,240 km from Neptune's centre).

**Placement (`src/sim/spacecraft.ts`, pure).** A trajectory is segments of states relative to a centre: the Sun
(the root) or a planet (a direct child of the root). A craft at `jd` = centre + interpolated offset, mapped with
`displayOffset` around the centre (`childDistanceCurve`: `orbitDistance` around the Sun, `moonDistance` around a
planet), so in every preset a flyby bends around the drawn planet and never enters it. Inside a planet segment's
inner radius (1 Hill radius) only it counts, beyond its outer radius (1.5) only the Sun's; between them the two
blend by a smoothstep of the distance, so the hand-over never jumps (tested in every preset). Readouts (distances,
signal time = distance to Earth / c, speed relative to the anchor) use the TRUE positions. `craftPhase`:
`planned` before launch, `active`, then the mission end's kind.

**Scene.** `Scene.tsx` creates a `CraftFrame` (`spacecraft/craftFrame.ts`) beside the SimFrame; `SpacecraftScene`
updates it at `useFrame` priority -0.9 (after SimClock, before the director) and draws:

- markers (`CraftMarkers.tsx`): 9 px cyan diamonds with a dark rim (bodies are round dots), dimmer for a silent
  craft; hidden near a planet that is still a dot until 10 px clear of it (the moon-name rule), unless selected or
  hovered; angular picking; hover shows the pointer, a tap selects.
- paths (`CraftPaths.tsx`, for the selected and hovered craft, or all with "Show every path"): the cruise path in
  the Sun's frame with each vertex placed where the planets were at that time (rebuilt on a scale change), bright
  up to the craft and dim beyond; during an orbit phase (Cassini, Juno, JWST) a local track of +-`trackDays`
  around where the planet is now instead; milestone rings at the events on the selected craft's path.
- names: a `LabelExtension` (`craftLabels.ts`) owns the label slots after the bodies' and orbits'
  (`labelSlotCount(n)` on) and joins #20's layout pass, so craft names obey the same placement, keep-out, fading
  and collision rules and never overlap a body's name. Rank: hovered craft first, selected above any body, else
  after every body and before orbit names. `SpacecraftLabelLayer.tsx` renders `<span data-craft>` into the shared
  board (cyan text); the marker's raycast also picks the names.

**Store (`src/store/spacecraft.ts`).** `showSpacecraft` (on), `showAllPaths` (off), `selectedCraftId`,
`hoverCraftId`, `trajectoriesReady`. Selecting a craft clears the body selection; choosing a body or any request for
the overview (home, Escape) clears the craft. Not in the URL yet.

**HUD.** `SpacecraftMenu` (satellite button beside the focus picker): layer switch, "Show every path", every craft
with its tagline and status at the simulation date; picking one selects it and flies there (`showCraft`: a point
view at the craft, anchored to its neighbourhood, framed so the Sun or the planet stays in view).
`SpacecraftInfo` replaces `BodyInfo` while a craft is selected: status lamp, launch, distance from the Sun and
Earth, signal time, speed, "Show", the reading-level description and the milestones; a milestone glides time there
(`travelAndStop`) and focuses the planet (or the craft's position). Events after `asOf` are marked "planned";
positions at a future date "predicted".

**Content.** `src/locales/<locale>/spacecraft.json` (`@/i18n/spacecraft`: `useSpacecraftText`,
`spacecraftName`): name, tagline and a description at every reading level, tested for every locale. UI strings
under `solarSystem.spacecraft.*`; event targets that are not bodies (Pluto, Arrokoth, L2) under
`solarSystem.spacecraft.target.*`.

**Adding a craft:** add it to `data/spacecraft.json` (a planet-centred orbit phase gets an `orbits` entry), run
`pnpm build:spacecraft`, add its content to every `spacecraft.json` locale, run `pnpm test`.

## Birthday (`features/solarSystem/birthday`, `src/store/birthday.ts`; #26)

"Your birthday in space": a birth date picked in a calendar (never typed) gives the age on every planet, the next
birthday there as a date (and a trip to it), local days lived, the distance Earth carried you around the Sun, and the
weight on the Sun, the planets and the seven large moons.

- Maths (`birthday.ts`, pure): a year is the sidereal `orbit.periodDays`; a birthday on a planet is
  `birthJD + n * year`, the instant it is back where it was at the birth. On Earth ages count calendar birthdays (29 Feb falls on
  28 Feb). A birth date is a calendar day that stands for its noon UTC (`arrivalJD`, the instant the planets fly to).
  Solar day: `1 / solar = 24 / rotation.periodHours - 1 / year` (sign = retrograde). Gravity: the curated
  `info.gravity` (the dictionary's number), else `G M / R^2`; weight = kg x g / g(Earth). Distance: Earth's orbit
  length (Ramanujan) x orbits since birth.
- UI: `Birthday.tsx` has the HUD button (in the time controls) and the panel slot; `BirthdayPanel.tsx` (lazy, with
  `@mantine/dates`) is a non-modal panel docked at the right (a sheet on phones) so the scene stays visible. Picking
  a date `travelAndStop`s there; each planet's next birthday is a button that does the same. The hero page links to
  `/solar_system?birthday=true`.
- Privacy: `useBirthdayStore` is memory only (no storage, nothing sent). While a birth date is entered the URL
  carries no `t` (`hidesTimeInUrl`, read by `urlSync.ts`), because the clock then shows the birth date. "Save as
  picture" (`card.ts`) draws a PNG with Canvas 2D on the device: ages and distance, never the birth date.

## Light travel (`src/sim/light.ts`, `src/store/light.ts`, `features/solarSystem/light/`; #27)

Every light time comes from TRUE positions; only the drawn front goes through the scale engine.

- Pure (`src/sim/light.ts`): `SPEED_OF_LIGHT_KM_S`, `lightSeconds`, `frontRadiusKm(emitJD, jd)` (c x simulation
  time since the flash, 0 before it), `truePositionAt` (one body's true position at any JD), `arrivalJD` (solves
  |pos(t) - origin| = c (t - emitJD): the light meets a body where it is on arrival), `distanceBetweenKm`,
  `neighbourhoodRadiusKm` (Hill sphere, at least 4 radii) and `distanceRangeKm` (the min/max over both orbits, e.g.
  Mars 3 to 22 light-minutes from Earth).
- Store (`useLightStore`): `pulse` = `{ emitterId, emitJD }` only; the front is a function of the clock, so it
  pauses, speeds up and runs backwards with everything else. `send()` also sets the clock to 1x forwards (real time
  is the lesson; faster is a deliberate click in the time controls, and the panel says the clock still counts true
  travel time). Panel state (`open`, `tab`, emitter, delay target). Not persisted or in the URL.
- Drawing (`light/lightFront.ts`, `LightFront.tsx`, in the Canvas after the markers): the circle where the light
  sphere cuts the plane through its source, centred on where the source was when it sent the flash (fixed in the
  Sun-centred frame), plus a faint glow fan and a DOM label ("Light · 4 min 12 s", drei `Html`) riding on it toward
  the next body it reaches. Each point is drawn like a body: anchor's drawn position + `displayOffset` of its true
  offset from the anchor. The anchor is the Sun (the planets' rule, so the front crosses every drawn planet exactly
  on arrival in every preset), except while the front is inside the source planet's neighbourhood (a planet, or a
  moon's planet): then that planet with the moons' rule, so the Earth -> Moon flash crosses the drawn Moon at 1.3 s.
  That early front fades out over the outer 40 % of the neighbourhood, where the two rules disagree (in every preset
  but true scale, where both are the identity). In an anchored frame (#31) a Sun-anchored point moves like a planet
  at that place would (`framedOffset` from each anchor, weighted; `mapTruePointKm`), so arrivals stay on time.
- Panel (`light/LightPanel.tsx`, a `.panel` in the picker stack under the picker; a button with the running clock
  while closed): Flash (source picker, running clock, distance covered, clock note with "Back to real time",
  arrivals `pulseArrivals` announced in an `aria-live` line), Signal delay (from Earth to any body: picked, or the
  scene selection; one way, round trip, live distance, range, what it means for a rover), Farther out (Proxima
  Centauri, the galactic centre, Andromeda). Durations: `formatDuration` in `light/lightTravel.ts` (ICU units under
  `solarSystem.light.duration.*`, abbreviated at standard/advanced, spelled out at simple).

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
