# Contributing

Thanks for helping! Bug reports, fixes, fidelity improvements (making the screens match iOS pixel for pixel) and new
phone languages are all welcome. For bigger changes, open an issue first so we can agree on the approach.

## Setup

You need Node 22.12+ and pnpm (`corepack enable` picks the version from `package.json`).

```bash
pnpm install
pnpm dev        # http://localhost:5199, the app and the Worker
```

No Cloudflare account is needed for development: KV, R2 and the Durable Object run locally (`.wrangler/state`).

## Before you open a pull request

```bash
pnpm format     # Prettier
pnpm lint       # oxlint
pnpm typecheck  # the app, the Worker and vite.config.ts
```

CI runs the same checks and a production build. There is no test suite yet; describe how you checked your change in
the pull request (a before/after screenshot helps for anything visual).

## Where to change what

- **Script language**: the parser is [`src/lib/script.ts`](src/lib/script.ts), `@settings` are in
  [`src/lib/presets.ts`](src/lib/presets.ts). [`src/lib/script-docs.ts`](src/lib/script-docs.ts) is the reference shown
  in the app and the prompt for AI tools; update it with any syntax change.
- **Project fields**: add the field to [`src/lib/types.ts`](src/lib/types.ts), its default to `defaultProject()` in
  [`src/lib/defaults.ts`](src/lib/defaults.ts) and its validation to `sanitizeProject()` in
  [`src/lib/project-schema.ts`](src/lib/project-schema.ts). Saved projects and shared links go through it, so a field
  that isn't there is dropped.
- **UI text** (English and Turkish): [`src/lib/ui-i18n.ts`](src/lib/ui-i18n.ts) for the editor and the share page,
  `COPY` in [`src/landing/Landing.tsx`](src/landing/Landing.tsx) for the home page, and
  [`src/lib/script-docs.ts`](src/lib/script-docs.ts) for the script guide. Strings drawn on the phone ("Delivered",
  "typing…") are in [`src/lib/i18n.ts`](src/lib/i18n.ts).
- **Worker**: routes are in [`worker/`](worker). After changing `wrangler.jsonc`, run `pnpm cf-typegen` to update
  `worker/worker-configuration.d.ts`.
- **User-visible features**: also update the home page and this repo's `README.md`. If the look changes a lot, update
  the link-preview images (`public/og.png`, `public/og-app.png`) and bump `OG_VERSION` in
  [`worker/pages.ts`](worker/pages.ts).

## Fidelity tools

The screens are measured against iOS 26 simulator screenshots (iPhone 17 Pro, 3×) and the balloon colours in ChatKit's
asset catalog. In development, `window.__cvm` renders frames for comparison and saves them to `.shots/`:

|                                          |                                                               |
| ---------------------------------------- | ------------------------------------------------------------- |
| `__cvm.shot(name, 'ref26')`              | the phone screen at 3× for a fixture in `src/dev/fidelity.ts` |
| `__cvm.screen(name, script, t?, patch?)` | the phone screen at 3× for any script (iMessage or WhatsApp)  |
| `__cvm.frame(name, t)`                   | a full output frame of the open project                       |
| `__cvm.sheet(name, [t1, t2, …])`         | several moments side by side                                  |
