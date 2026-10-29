# Design Mode — key decisions

What was decided, why, and what was turned down. Newest context first in each
section. The original plan, sketch and design reviews are in [history/](history/).

## Product

| Decision | Why |
|---|---|
| **Dev only.** Exists only while the app runs under `vite` dev (`apply: 'serve'`); never in a build. | It's a design tool for the person building the app, not a feature for users. |
| **Tweaks live on the page and reset on reload.** A "Leave site?" prompt appears only if there are changes not yet copied. | The code is the source of truth. The tool's output is the prompt, not saved state. Vite sometimes reloads by itself, so the prompt guards uncopied work. |
| **The output is one plain-text prompt for any AI coding agent** (Claude Code, Cursor, Codex, Copilot…). Never describe it as Claude-only. | The prompt is just text: file:line, what it was, what it should be, how far it reaches. Any agent that edits code can apply it. |
| **Every edit has a scope:** only this one · every instance from the same line of code · every instance of the component with this prop value · the component's default. Hovering a scope outlines what it covers. | "Change this button" is ambiguous in a design system. The chip spells out what "all" means so the prompt is unambiguous. Plain HTML tags are always "only this one". |
| **Three value levels:** app token (from the app's Tailwind `@theme`, shown with ◇) · scale step (Tailwind's built-in steps, other `:root` variables) · raw (arbitrary `[…]` classes, inline styles, hand-written literals; amber "raw" flag). | With only token vs raw, nearly everything in a Tailwind app is "raw" and the flag means nothing. |
| **Token-first pickers; raw values allowed but flagged.** | Nudges toward the design system without blocking exploration. |
| **Pickers fall back to color variables by value** when an app has no `--color-*` names. | Non-Tailwind apps (and the landing page) name colors `--blue`, `--text`. |
| **Show all styles = four groups:** Layout, Typography, Fill and stroke, Effects, including properties the component doesn't expose. | You can tweak anything, even what the component doesn't let you override. Groups collapse; changed ones open themselves. |
| **Figma's words in the panel** (Fill, Stroke, Line height); the prompt adds the CSS name in brackets. | The audience is designers; the agent still needs the CSS. |
| **Text is edited in a panel field**, not by typing on the page. | Editing in place fights the app's own event handlers. |
| **Panel floats and drags; launcher drags and remembers its spot.** Panel moves to the other side if it would cover the selection. | It must never hide what you're editing. |
| **Select mode swallows clicks and keys; Freeze pauses animations and input.** Shortcut ⌥⇧D toggles the tool; single-letter keys only act while the tool is in use. | Clicking "Practice" in midiplay must not start playback; letter keys play piano notes there. |
| **Force Hover / Pressed** for the selected element. | Lets you edit states you can't hold with the mouse. |
| **Blue = selected or the action. Green dot = changed.** | Blue used to mean four things (design review #9). |
| **React + Vite first.** Plain HTML mode and Next.js are planned. React Native/Expo is out of scope (not a browser). | The user's apps are mostly React web. |
| **Public repo, MIT license** (© Lychee Studio Inc.), installed from GitHub (`npm install -D github:aymenr/design-mode`), not npm. | Anyone can try it; no publishing step. |

### Turned down in the design review ([history/design-critique.md](history/design-critique.md))

- **#7** Nudging prop edits back toward the design system.
- **#10** Raising the panel's faint-text contrast (the landing page *does* meet AA).
- **#15** A "sent" state after copying.
- **#16** A full keyboard/focus spec.
- **#17** Showing written values before computed ones.
- **#21** Validating raw input.
- **#19** "Dropdown past 3 options" was declined as a rule. In practice a segmented control is only used for ≤3 short options (or 4 very short); otherwise it's a select.

## Engineering

| Decision | Why |
|---|---|
| **Its own project**, loaded by apps as a Vite plugin. Midiplay loads `../../design-mode/dist/vite.js` only if it exists, so its CI never needs it. | One install and one config line per app. The host app's code stays untouched. |
| **The UI lives in a shadow root on `<design-mode>` attached to `<html>`**, outside `<body>`. | App styles can't break the panel and vice versa. It also stays outside code that walks `<body>` (midiplay's `useInertOutside`). |
| **Preact for the panel, bundled in**, not the app's React. | Works on pages without React, never shares or disturbs the host's React. |
| **The plugin rewrites JSX in dev:** HTML elements get `data-dm-src="file:line:col"`; component props are wrapped in `{...__dmProps(src, name, {props})}` that calls `globalThis.__dm`. `key` stays outside the spread; Fragments are skipped. | React 19 dropped `_debugSource`, so file:line has to be added. Routing props through `__dm` lets prop edits apply on every render. |
| **Prop edits:** the line, type and default scopes go through `__dm` rules; the instance scope goes through React DevTools' `overrideProps`, re-applied after every commit (`onCommitFiberRoot`). | Midiplay re-renders constantly during playback; a one-off change would be wiped on the next frame. |
| **Variants come from TypeScript types**, read by the plugin (`/@design-mode/component.json`). Unions become pickers, booleans toggles, plain `string` a text field. Prefers exported declarations and follows local imports. | The running page only knows the current value, not the options. |
| **Tokens come from the app's Tailwind `@theme`** (`/@design-mode/tokens.json`). On a plain page, everything on `:root` counts as the app's. | Tailwind only emits a variable once something uses it, so the page alone misses unused tokens. |
| **A simplified CSS cascade** finds the declaration that set each value (layers, specificity, inline). | The browser only gives computed values; the level label needs `var(--x)` as written. |
| **Style edits go into one override stylesheet with `!important`**, targeting `[data-dm=key]` (this one) or `[data-dm-src=…]` (line/every). | Easy to undo one or all; nothing written into the app. |
| **Build:** esbuild → `dist/client.js`, `dist/vite.js`, a hand-written `dist/vite.d.ts`, and a minified `site/design-mode.js` for the landing page. `prepare` builds on install from GitHub; `files` lists `dist`. | Host apps never compile anything. npm honours `.gitignore` for git installs unless `files` is set. |

## Website

| Decision | Why |
|---|---|
| **designmode.thelycheestudio.com**, a static page on the Cloudflare Worker `design-mode-site` (`npm run deploy:site`). | Lives under the studio's domain. |
| **The landing page runs the real tool on itself**, with a pulsing ring and callout on the launcher and a "Try it on this page" button. | Showing beats describing. The callout hides once the visitor uses the tool or dismisses it. |
| **SEO:** canonical, OG/Twitter tags + `og.png`, sitemap, robots, JSON-LD (SoftwareApplication, Organization, FAQPage). The visible FAQ must match the JSON-LD FAQ. | Google requires FAQ structured data to match visible content. |
| **Skipped in the landing review:** testimonials or user counts (none exist yet), a "free" claim on the page, a new icon set, a light theme. | See [history/landing-critique.md](history/landing-critique.md). |

## Lessons that cost time

- **Stale fibers.** After a scope change or prop edit, rebuild the tree before reading `memoizedProps`, or `before === after` and the edit is dropped.
- **The tool loads before the app's CSS.** Reload tokens when the panel opens or select mode starts, or scale variables come back empty.
- **The browser pane doesn't advance CSS transitions when hidden.** Verify colors via class names or with `transition: none`, not computed color mid-transition.
- **Case-insensitive disk:** `styles.ts` and `Styles.tsx` collide. The UI CSS is `css.ts`.
- **Events from inside the shadow host are stopped**, so window drag listeners must use the capture phase.
- **oklab/oklch colors** are converted through a canvas pixel to get a hex.
