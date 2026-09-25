# Astrolabe

_Klassenlager 2022 project_

## Preface

We want to create both a visual dictionary as well as a 3D model of our solar system.

Along side the fun of dealing with our solar system, this project aims to be a playground especially for [GSAP](https://greensock.com) as well as [Three.js](https://threejs.org) and if we will have enough time and reach it also [Theatre.js](https://www.theatrejs.com/).
In the background of it thought, is the use of the Panter stack and implamantation of frontend concepts from my training program such as:

- coding techniques:
  - KISS, DRY, SOLID and Occam’s Razor principles
  - Design patterns in frontend development
  - Functional Programming
  - Component Design
  - Code quality
  - Best practices
  - Project structure - file structure, naming conventions
- Practical:
  - TypeScript
  - React (Vite)
  - State Management
  - Working with a static, validated data set
  - Building functional components
  - Routing
  - Responsivity
- Tooling
  - GIT
  - formatters (prettier), linters (eslint)
  - CI/CD basics (set up of the project pipelines)
- Soft skills
  - Solve mid complex problems independently

#### I value the care and effort to improve in case of any comment by the reader feel free to contact me at odi@panter.ch

# Getting started

## Setup

A client-only [Vite](https://vitejs.dev/) + React 19 + TypeScript app. See
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full contract.

- routing: [TanStack Router](https://tanstack.com/router) (file routes in `src/routes`)
- 3D: [Three.js](https://threejs.org) via [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber), drei and postprocessing
- animation: [GSAP](https://greensock.com)
- UI: [Mantine](https://mantine.dev/) 9 with CSS modules
- data: static JSON in `data/` (no server, no GraphQL)

Requirements: Node 22 (`.nvmrc`) and [pnpm](https://pnpm.io).

### Scripts

- `pnpm install` installs dependencies (and the git hooks through husky)
- `pnpm dev` starts the dev server on [localhost:5173](http://localhost:5173)
- `pnpm build` builds the static site into `dist/`
- `pnpm preview` serves `dist/` locally
- `pnpm typecheck` runs the TypeScript compiler
- `pnpm lint` runs ESLint
- `pnpm format` / `pnpm format:check` runs Prettier
- `pnpm test` runs the Vitest unit tests
- `pnpm test:e2e` runs the Playwright smoke tests against `pnpm preview` (run `pnpm build` first; once: `pnpm exec playwright install chromium`, plus `sudo pnpm exec playwright install-deps chromium` on a bare Linux box for the system libraries such as `libasound2`)

Set `VITE_BASE=/sub/path/` when the site is served from a sub path.

## Contributing

- If you'd like to contribute, by all means fork the repository and use a feature branch.
- Pull requests are warmly welcome.
- There are few known bugs and some unintentional behaviors.

## Licensing

The code in this project is licensed under the MIT [license](LICENSE).

The moon surface maps come from NASA, USGS and other open sources; each one's source, credit and licence is
recorded in `data/moon-surfaces.json` (and listed in `src/data/credits.json`).
