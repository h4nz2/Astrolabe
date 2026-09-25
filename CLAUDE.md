This is an educational app, that is meant to teach people about solar system and space objects and physics in general. It uses graphics and interaction to visualize to people, how large space is and how objects move in space.

Typical user of this app is a teacher, who wants to teach his students about the solar system and space in general. Other users of this app might be anyone fascinated by space and would like to have a visual tool to look at the amazing stuff.

This is an open source project, which is not bound by any external requirements, so anything is an option when it comes to technologies, data sources and ideas.

## Keep the help page current

The in-app help page (issue #43) lists every user-facing feature with what it is, why it is worth using, how to use it and a "try it" link. Adding, changing or removing a user-facing feature includes updating its help entry, in every locale and reading level, in the same change. A feature is not done until its help entry is.

How: add the entry (its group and a "try it" link) to `src/data/help.json` and its words to `src/locales/<locale>/help.json` in every locale, with a simple and a standard version; no code is needed. `pnpm test` (`src/features/help/help.test.ts`) and `e2e/help.spec.ts` check that every entry is complete and every link opens. See `docs/ARCHITECTURE.md`, "Help page".
