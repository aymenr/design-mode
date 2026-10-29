# Design Mode — notes for coding agents

Dev-only design inspector for React + Vite apps. Click anything in the running app,
edit props, variants, styles and text live, and copy one prompt that tells any AI
coding agent which file and line to change. Public, MIT, by Lychee Studio.

- **Why things are the way they are:** [docs/decisions.md](docs/decisions.md). Read it before changing behaviour.
- **Install, controls, code layout:** [README.md](README.md).
- **Original plan, sketch and design reviews:** [docs/history/](docs/history/).

## Commands

| | |
|---|---|
| `npm run dev` | Rebuild `dist/` on every change; reload the host app to pick it up |
| `npm run build` | One build: `dist/client.js`, `dist/vite.js`, `dist/vite.d.ts`, `site/design-mode.js` |
| `npm run typecheck` | TypeScript check |
| `npm run deploy:site` | Build, then deploy `site/` to designmode.thelycheestudio.com (Cloudflare Worker `design-mode-site`) |

There are no unit tests. Verify in a real app in the browser: midiplay
(`../falsa club/falsa-club-midiplay`, launch config `design-mode-dev` on port 5174)
loads this folder's `dist/vite.js` automatically, and the landing page runs the tool
on itself.

## Rules

- Keep the product agent-neutral: say "your coding agent", never "Claude" alone.
- Dev only: nothing may run in a production build (`apply: 'serve'`).
- Never touch the host app's styles or React tree directly: UI stays in the shadow
  root, edits go through the override stylesheet, `__dm` rules or `overrideProps`.
- The site's visible FAQ and its JSON-LD FAQ must say the same thing.
- Comments explain *why* in plain words, like the existing code.
