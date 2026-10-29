# Design Mode — build plan

> **Status (2026-10-28):** phases 1–5 are built and tested in midiplay. The tool
> lives at `apps/design-mode`; midiplay loads it from `vite.config.ts` in dev only.
> Not yet built: the "Later" items at the end of the phases table.

A dev-only tool you can drop into any of your web apps. A floating button opens a
panel. From it you can click any element on the page, see what it is, change it
live, and copy a prompt that tells Claude how to make those changes for real.

It ships first in falsa-club-midiplay. It's built as its own project so other apps
can add it later.

---

## What you'll see

The sketch is in [design-mode-sketch.html](design-mode-sketch.html). Version 2
applies the accepted points from the [design review](design-mode-critique.md).

**The button.** A small round button, bottom right, with a little arrow beside it.
It only exists when you run the app on your machine. The published site never has
it. It hides while the panel is open, and the panel's ✕ brings it back.

**Shortcut.** One shortcut turns Design Mode on and off: ⌥⇧D. Plain letter and
arrow keys only act when the tool is in use, so they never play piano notes or type
into the app's fields.

**Select mode.** Clicking the button goes straight into select mode. The small arrow
opens a short menu: Open panel, Copy prompt, Hide my changes. Moving the mouse
highlights whatever is under it, with its name in a small tag. Clicking selects it.
⌥-click selects the plain tag rather than the component around it. Esc stops.
While select mode is on, the app doesn't get the clicks or key presses, so clicking
"Practice" never starts playback.

**Freeze.** A button in the panel header pauses the page, so menus, popovers and
dialogs stay open while you inspect them. You can also force the selected element
into its hover or pressed look.

**The panel.** It floats over the page and you can drag it. Its header is the same
on every screen and has two tabs:

| Tab | What it shows |
|---|---|
| **Inspect** | **Layers** on top: a nested list of the page, like Figma's layers panel. By default it shows components only; a "+ tags" switch adds plain HTML tags. Repeated items are grouped ("Card ×3"), the tree opens to and scrolls to the selection, and its height is capped. When collapsed it shrinks to a one-line path instead of disappearing. Below it, the **Inspector**: name, whether it's a component, the file and line, then **properties**. "Properties" (props) are the settings a component accepts, e.g. Button's `variant` = primary / control / quiet / ghost. For plain HTML: its text, its classes and its styles. |
| **Changes** | Every edit, grouped by file. Each row has an eye (turn just this change off and on to compare), "show on page", and undo, with tooltips. Then a prompt preview, **Copy prompt**, and **Discard all** kept apart at the far left. |

**This one or all of them.** As soon as you change a value, a small chip appears
under that row saying what it applies to, and it spells out what "all" means, e.g.
"Only this one", "Every Practice button (same line of code)", "Every Card (edits
Card.tsx)", or "Every Button with variant = primary (41 places in 12 files)".
Hovering an option outlines every instance it would hit. Plain tags are always
"only this one".

**Colors in the tool.** Blue only ever means "selected" or "this is the action".
A change you made gets a green dot and a bold label.

**Styles.** Each value shows one of three levels:

| Level | Looks like | Example |
|---|---|---|
| **App token** | Diamond icon + name | `color-ctrl`, `radius-ctrl`, `font-inktrap` (named in the app's theme) |
| **Scale step** | Plain value | padding 16, size 14: Tailwind's built-in steps like `px-4` and `text-sm` |
| **Raw** | Amber value + "raw" flag | height 50 from `h-[50px]`, or an inline style |

Without the middle level nearly everything in this app would be flagged "raw",
and the flag would stop meaning anything.

**Style groups.** Styles are always listed as four collapsed groups with a one-line
summary. Any group you've changed opens by itself. **"Show all styles"** opens all
four, including properties the component doesn't offer, and nothing else on the
panel disappears. The groups:

- **Layout:** width, height, padding, margin, gap, alignment
- **Typography:** font, size, weight, line height, letter spacing, text color
- **Fill and stroke:** fill (background), stroke (border) color and width, corner radius
- **Effects:** shadow, opacity, blur

**Changing a value.** Pickers list matching tokens first. You can also type any raw
value, and it gets flagged as raw.

**Words.** The panel uses Figma's names (Fill, Stroke, Line height, Letter
spacing). The prompt adds the CSS name in brackets, e.g. "Fill (background)".

**Text.** Edited in a field in the panel, not by typing on the page.

**Reload.** Reloading the page clears every tweak. You get a clean slate each time.
If you have changes you haven't copied yet, the browser asks "Leave site?" first.
That matters because the build tool sometimes reloads the page by itself when a
file is saved. **Discard all** shows an Undo for 8 seconds.

---

## The Claude prompt

One block of text you paste here. For each change it lists:

- **Where:** the file and line (e.g. `src/ui/library/LibraryPanel.tsx:84`)
- **What:** the component or tag, and which prop or style changed
- **Old → new value:** with token names where there are tokens, e.g.
  `Fill (background): --color-card → --color-drawer`, or
  `Padding (padding-inline): 16px → 20px`
- **Scope:** spelled out the way the chip said it, e.g. "this instance only",
  "every Card (edit Card.tsx)", or "every Button with variant = primary (41 places)"

Tailwind is a styling system where styles are written as short class names, like
`bg-card`. In apps that use it, the prompt also names the class that set the
value, so Claude knows which class to swap.

---

## Engineering decisions (made by me, for the record)

| Decision | Why |
|---|---|
| **Its own project** at `apps/design-mode`, added to midiplay as a local package | So any app can add it with one install and one line of config, and midiplay's code stays untouched. |
| **The panel lives in a sealed-off box** (the browser's Shadow DOM, which keeps a page's styles and the tool's styles from leaking into each other) | Midiplay's styles can't break the panel, and the panel can't change how the app looks. |
| **The panel has its own small UI library** (Preact, a lightweight React lookalike), separate from the app's React | The same panel then works on plain HTML pages with no React at all. |
| **A Vite plugin stamps each element with its file and line** while you're developing. Vite is the build tool midiplay already uses. | React 19 no longer records where a component was written, so the tool has to add that information itself. This is what makes "file and line" in the prompt exact. |
| **The same plugin reads each component's TypeScript types** to find its variants. TypeScript types are where the code spells out a component's options, e.g. `variant: 'primary' \| 'secondary'`. | A running page only knows the current value. The types give the full list of options for the dropdown. |
| **Prop overrides apply every time the component redraws** | Midiplay redraws constantly during playback. A one-off change would get wiped out on the next frame. |
| **Style overrides go into one stylesheet the tool controls** | Easy to undo one change or clear them all. Nothing is written into the app's code. |
| **Tokens are found by reading the page's own stylesheets** | Shows which rule set a value, so `var(--color-card)` is reported as the token `--color-card`, not just the color it turns into. |

---

## Build phases

Each phase ends with something you can try.

| # | Phase | What you can try at the end |
|---|---|---|
| 1 | **Shell** — new project, floating button, select mode, draggable panel, layers tree, basic element info | Click anything in midiplay and see its tag, classes, and size. Browse the layers tree. |
| 2 | **Style inspector** — the four style groups, token vs raw labels, token-first pickers, text editing, undo | Change a card's background to another token and see it live. Edit button text. |
| 3 | **Component layer** — file and line stamping, components shown in the layers tree, prop editing, "this one / all" switch | Select a `Button`, switch its variant from the panel, and watch it change. |
| 4 | **Prompt** — the changes list and Copy prompt | Make a few edits, copy, paste here, and I apply them. |
| 5 | **Polish in midiplay** — test against the kit (`Button`, `Card`, `Chip`, `Dialog` and the rest) and the main screens, fix rough edges | Use it on real work. |

Later, not in this build:

- **Plain HTML mode** — a single script tag for sites without React (portfolio, viz,
  and others). They get styles and text only, no components.
- **Next.js** (SAMPLER) — it uses a different build tool, so it needs its own
  version of the plugin.
- **React Native / Expo apps** — phone apps don't run in a browser, so this approach
  doesn't reach them. That would be a separate project.

---

## Known limits

- **The piano roll and falling notes are drawn onto a canvas.** A canvas is one
  flat image the code paints pixels onto, so there are no separate elements inside
  it to select. The tool can select the canvas as a whole, but not the notes. Their
  look is already tuned in the existing Dev Control Panel.
- **"All instances" previews only components.** Previewing a change to every plain
  `div` styled the same way isn't reliable, so for plain HTML the switch is limited
  to "just this one".
- **Variants come from TypeScript types.** If a component accepts any string for a
  prop instead of a fixed list, you get a text field instead of a dropdown.
