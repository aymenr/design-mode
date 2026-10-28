# Design Mode

A dev-only design inspector for React + Vite apps. Click anything in your running
app, change its props, variants, styles and text live, then copy one prompt that
tells your AI coding agent (Claude Code, Cursor, Codex, Copilot…) exactly which files
and lines to change. It shows up only while the
app runs with `vite` dev, never in a build.

Site and docs: https://designmode.thelycheestudio.com

## Install

```bash
npm install -D github:aymenr/design-mode
```

Then add the plugin in `vite.config.ts`, before React's:

```ts
import designMode from 'design-mode/vite'

export default defineConfig({
  plugins: [designMode(), react()],
})
```

Run `vite` as usual. The button appears bottom right.

## Develop the tool itself

```bash
npm install && npm run dev   # rebuilds dist/ on every change; reload the app to pick it up
```

To try it in an app without installing, load `dist/vite.js` from this folder in the
app's `vite.config.ts` (see falsa-club-midiplay's for a version that skips it quietly
when the folder isn't there, so CI never needs it).

The landing page is in `site/` and deploys to Cloudflare with `npm run deploy:site`.

## Controls

| | |
|---|---|
| Round button | Select mode: hover outlines, click selects. Drag it to move it; it remembers the spot |
| Small arrow beside it | Menu: open panel, copy prompt, hide changes, turn off |
| ⌥ Click | Select the plain tag instead of the component around it |
| ↑ while selecting | Move to the parent |
| Esc | Closes the innermost thing: menu, select mode, selection, panel |
| ⌥⇧D | Turn Design Mode on or off |
| Snowflake | Freeze: the app gets no input and its animations pause |
| Show as: Hover / Pressed | Shows the selected element in that state, like DevTools' force state |
| Copy prompt | In the Changes tab: copies every change as one prompt for your coding agent, with file:line, old → new and scope |

## How file and line work

While the app runs in dev, the plugin rewrites each `.tsx`/`.jsx` file on its way to
the browser: HTML elements get a `data-dm-src="file:line:col"` attribute, and
component props are routed through `__dm(…)`, which adds the same location and
applies prop edits made in the panel. Builds are untouched.

## Layout

- `src/vite.ts`: the Vite plugin (serves the client, injects one script tag, rewrites JSX)
- `src/jsx.ts`: the JSX rewrite that adds file and line
- `src/propTypes.ts`: reading a component's props and variants from its TypeScript types
- `src/theme.ts`: reading the app's tokens from its Tailwind `@theme`
- `src/client/fiber.ts`: reading React's internal tree
- `src/client/liveProps.ts`: applying prop edits (rules via `__dm`, plus React's dev hook)
- `src/client/overrides.ts`: putting style, text and prop edits on the page
- `src/client/tree.ts`: the layers tree, built from React or from the DOM
- `src/client/controller.ts`: state, input handling, keeping the tree fresh
- `src/client/ui/`: the panel, built with Preact inside a shadow root

## License

MIT © Lychee Studio Inc. See [LICENSE](LICENSE).
