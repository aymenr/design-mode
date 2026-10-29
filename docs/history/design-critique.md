# Design Mode — design review of the sketch and plan

Ticked = accepted and applied to sketch v2 and the plan (2026-10-27). Unticked = declined. Ordered by severity. Each item names the principle behind it.

---

## High

- [x] **1. The panel's layout changes from frame to frame** — High · Effort M · Frames 3, 4, 5, 6, 7
  Frame 3 has a "Design mode" header with Layers on top. In frames 4 and 5 the header becomes "Button" or "Card" and Layers is gone. Frame 7 is a "Changes" panel with different header icons. The plan describes one panel with three stacked parts. As a user you can't tell where you are or how to get back to Layers or to Changes.
  *Principle:* Nielsen #4 consistency and standards, and #6 recognition over recall (you shouldn't have to remember how you got to a view).
  *Change:* one fixed header on every frame, with two tabs: **Inspect** (Layers + Inspector) and **Changes (3)**. Layers collapses to a single strip instead of disappearing. **Challenges a decision:** the plan has Changes stacked under the Inspector, but a 300px floating panel can't hold all three parts, and the frames already don't do it.

- [x] **2. "This one / All Buttons (41)" doesn't say which edit it applies to, or what "all" means** — High · Effort M · Frames 3, 6, 7
  The switch sits in its own row under all the properties. Does it apply to the edit you just made, to edits you're about to make, or to everything on this element? "All Buttons (41)" also mixes two different things. Changing Card's fill for all Cards means editing `Card.tsx` once. Changing `variant` for all 41 Buttons means editing 41 places in the code (or changing the default value, which is something else again). The user feels the same click either way, but Claude gets two very different jobs.
  *Principle:* Nielsen #2 match with the real world, and Gestalt proximity: a control should sit next to the thing it controls.
  *Change:* put the scope on each edited row, shown as a small chip right after you change a value (and repeated in the Changes list), not as a separate row. Say what will happen: "Only this one", "Every Card (edits Card.tsx)", or "All 41 Buttons that use variant=primary (41 places)". While you hover "all", outline every affected instance on the page.

- [x] **3. In this app, almost every spacing and type value will show as "raw"** — High · Effort S · Frames 3, 4, 6, 7
  Midiplay styles everything with Tailwind (short class names like `px-4`, `text-sm`, `font-extrabold`). Tailwind's own built-in scales aren't listed in the app's `@theme` block (the file where the app names its design values). Only colors, radii and fonts are. If "token" means only names from `@theme`, then padding, gap, font size and weight are amber "raw" everywhere. Then the flag stops meaning anything, and the one value that really is hard-coded (like Button's `h-[50px]`) doesn't stand out.
  *Principle:* signal-to-noise. A warning that's always on gets ignored, the same problem as alarm fatigue.
  *Change:* define three levels. **App token** (from `@theme`, blue diamond). **Scale value** (a Tailwind built-in step like `px-4` or `text-sm`, neutral, no flag). **Raw** (a bracketed one-off like `h-[50px]` or an inline style, amber). Also make the sketch's values match the real Button: it uses `font-inktrap` extrabold and `gap-2`, not `font-machina 12/500` and `spacing-1.5`.

- [x] **4. Single-letter shortcuts will play piano notes** — High · Effort S · Frames 1, 2
  The launcher uses S, P and H. Midiplay turns the computer keyboard into a piano (`ComputerKeyboard.tsx`), and the app has search fields. Pressing S could play a note, type into a field, or open the tool at the wrong moment. The ↑ "go to parent" key also clashes with arrow keys the app uses.
  *Principle:* error prevention (Nielsen #5), and following DevTools conventions (Chrome uses ⌘⇧C to inspect).
  *Change:* one global shortcut with modifier keys (e.g. ⌥⇧D to toggle Design Mode). Plain letters and arrows work only while the panel has focus or select mode is on, and select mode stops the app from receiving those keys.

- [x] **5. You can lose every tweak in one click, or without clicking anything** — High · Effort S · Frames 1, 7
  "Discard all changes" in the launcher and the trash icon in Changes have no confirm and no undo. Reload wipes everything (agreed). But Vite, the build tool, sometimes reloads the page by itself when a file is saved, for example while Claude is applying an earlier prompt. That would silently erase work you haven't copied yet.
  *Principle:* error recovery (Nielsen #9) and user control and freedom (#3).
  *Change:* keep the clean slate on reload. Add (a) an "Undo discard" toast for about 8 seconds after Discard all, and (b) the browser's "Leave page?" warning when there are changes you haven't copied. Optionally, **challenges a decision:** keep only the last prompt *text*, not the tweaks, so "Copy last prompt" still works after an accidental reload.

- [x] **6. Editing a popover, menu or dialog that closes when you click away** — High · Effort M · Frames 2, 3
  Midiplay has `Popover`, `Menu` and `Dialog`. Many of these close on any click outside them, and a click on the floating panel counts as outside. So you open a menu, select its item, try to change it in the panel, and the menu closes. Select mode also needs to swallow the click, so clicking "Practice" doesn't start playback.
  *Principle:* mental model from Chrome DevTools (its "Emulate a focused page" and "force hover state" options exist for exactly this).
  *Change:* the selecting click never reaches the app. Add a **Freeze** button (pause the page so open things stay open) and a way to force hover/pressed states on the selected element. Decide and show whether select mode stays on after a pick (suggest: it turns off, like DevTools, and the pointer icon shows that).

---

## Medium

- [ ] **7. The tool lets you get around the design system instead of nudging you back to it** — Medium · Effort M · Frame 4
  In frame 4 the Button's padding is changed to a raw `8 16`, even though Button already has a `size` prop that controls padding and height. The tool makes the wrong path as easy as the right one, and the prompt asks Claude to hard-code padding on one button.
  *Principle:* error prevention, and Figma's habit of pointing you to the component property before a detached override.
  *Change:* when a style you edit is controlled by a prop, show one inline line: "Button's `size` controls this — try size = lg". In the prompt, label the change "override (bypasses Button's size)" so Claude can push back.

- [x] **8. "Show all styles" swaps the whole view in one frame and uses collapsible groups in another** — Medium · Effort S · Frames 3, 4, 6
  In frame 3 the switch is off and shows three style rows, chosen with no visible logic. Turning it on (frame 4) replaces the panel: Properties and Layers disappear. Frame 6 handles the same problem better, with the four groups listed and collapsed.
  *Principle:* progressive disclosure: reveal more without losing what you had. Consistency (#4).
  *Change:* use frame 6's pattern everywhere. The four groups are always listed as collapsed headers, with a "1 changed" count. Groups with a change open by themselves. Properties stays above. The switch becomes "Show all styles" inside the Styles header and only expands groups. Don't remove anything.

- [x] **9. Blue means four different things** — Medium · Effort S · Frames 3, 4, 5, 7
  Blue marks the selection, the hover outline, tokens (blue diamond + blue text), "changed" (blue dot + blue label) and the tool's main button. In frame 4, "Padding" is blue because it changed, and "spacing-1.5" next to it is blue because it's a token. They look like the same thing.
  *Principle:* Gestalt similarity: things that look alike are read as alike.
  *Change:* keep blue for selection and actions. Show tokens in the normal text color with the diamond icon. Show "changed" with a distinct marker that reads clearly, like Figma's: a filled dot plus a bold label, in a separate color (e.g. green or white) or with the reset arrow always visible.

- [ ] **10. Faint text fails contrast** — Medium · Effort S · All frames
  `--dm-faint` (#6c6a74) on the panel background (#1c1c20) is about 3.2:1. It's used for the notes that explain things ("'All' is for components only", "This text comes from the song's data…"), "collapsed", "was", the line-number meta and the raw-value label. A lot of the panel is 10–11px, which makes it worse.
  *Principle:* WCAG 1.4.3 contrast: 4.5:1 for normal text.
  *Change:* raise faint to about #8e8c96 (≥4.5:1). Use it only for decoration (icons, chevrons). Help text goes in `--dm-muted`. Minimum text size 11px, with 12px for anything you have to read to act.

- [x] **11. Click targets are too small** — Medium · Effort S · Frames 3, 4, 7
  Toggles are 26×15, the reset arrow is a 14px icon, layer rows are 22px tall, and the per-change "focus" and "undo" icons are tiny and sit right next to each other. Undo next to "find on page" is easy to mis-click.
  *Principle:* Fitts's law (small, close targets are slow and error-prone) and WCAG 2.5.8 (targets at least 24×24px).
  *Change:* make every hit area at least 24×24 even when the icon is smaller. Layer rows 24px tall. Put space between "focus" and "undo", or move undo to show on hover at the row's right end.

- [x] **12. The floating button sits on top of the panel** — Medium · Effort S · Frames 3, 4, 5, 6
  When the panel is open, the round button (with its badge) covers the bottom-right of the panel, right over the Styles rows. The panel's own header already has close and select buttons.
  *Principle:* visual hierarchy: one control for one job. The covered rows also break Fitts's law.
  *Change:* hide the floating button while the panel is open (the panel's ✕ brings it back). Or dock the button into the panel's corner. The change count moves to the Changes tab.

- [x] **13. The launcher menu repeats the panel and adds a step** — Medium · Effort S · Frame 1
  To select something you click the button, read a 6-item menu, then click "Select element". "Copy prompt", "Hide" and "Discard" are duplicated in the panel. Discard sits one row below Hide, with no separation.
  *Principle:* Hick's law (more choices, slower decisions), and the convention from Chrome's inspect arrow and Framer, where one click goes straight into picking.
  *Change:* clicking the button goes straight into select mode. Right-click or a small chevron opens the menu. Cut the menu to Open panel, Copy prompt and Hide changes. Move Discard into the Changes tab, away from the other actions.

- [x] **14. The layers tree will be huge in a real screen** — Medium · Effort M · Frame 3
  The sketch shows five tidy rows. Midiplay's real library screen will have hundreds of wrapper `div`s, providers and kit internals. The tree will be mostly noise, and the selected row will scroll out of view.
  *Principle:* information density and progressive disclosure. React DevTools hides plain tags by default for this reason.
  *Change:* default filter is **Components only**, with a toggle to show HTML tags. The tree scrolls to and expands the selected row by itself. Collapse runs of repeated siblings ("Card ×3"), which the sketch already hints at. Cap the tree's height so the Inspector stays visible.

- [ ] **15. After copying, you can't tell what happens to your tweaks** — Medium · Effort S · Frame 7
  You copy, paste into Claude, and Claude edits the code. The live tweaks are still applied on top, so the page may show changes twice (e.g. padding added on top of padding), or look right only because of the tweak. You can't tell what's real.
  *Principle:* visibility of system status (Nielsen #1), and the end-to-end flow: pick, edit, review, copy, *then confirm it landed*.
  *Change:* after Copy, mark the changes "Sent" and offer **Clear tweaks to see Claude's version**. When the page reloads after Claude's edit, the clean slate makes this happen by itself; say so in the toast: "Copied. Your tweaks clear when the app reloads with Claude's changes."

- [ ] **16. Keyboard use and focus aren't designed** — Medium · Effort M · Frames 2, 3, 5
  Esc already means "exit select mode". It will also need to mean close the color picker, deselect, and close the panel, with no stated order. There's no visible focus ring in the sketch, and arrow keys in the layers tree aren't defined.
  *Principle:* WCAG 2.1.1 keyboard and 2.4.7 visible focus. Conventions from Figma's layers panel (arrows move, Enter goes to the child, Shift+Enter to the parent).
  *Change:* Esc closes the innermost thing first (picker → select mode → selection → panel). The layers tree works with arrow keys. Every control gets a visible focus ring. Focus never jumps from the panel back into the app.

- [ ] **17. Values shown must be what the code says, not what the browser computed** — Medium · Effort M · Frames 4, 7
  Frame 4 shows Size "auto × 30" and Line "16", which are values the browser worked out. The code says things like `h-[50px]` or `text-sm`. If the panel shows computed numbers, then "old → new" in the prompt won't match anything Claude can find in the file.
  *Principle:* match the user's mental model of the source (Figma Dev Mode shows the authored value and the token, not only pixels).
  *Change:* show the value as written (class or token) first, with the computed pixels in small text after it ("text-sm · 14px"). The prompt uses the written value.

---

## Low

- [x] **18. Copy uses different words for the same thing** — Low · Effort S · Frames 3, 4, 6, 7
  "Fill" in the panel is "background" in the prompt. "Text" is a font row in frame 3 but the content field in frame 6. "Line · track" and "Shadow · blur" are shorthand. "⌥ Click — pick the plain tag inside" is hard to parse. The panel title switches between "Design mode", "Button" and "Changes".
  *Principle:* consistency (#4) and match with the real world (#2).
  *Change:* one glossary. Use Figma's words in the panel (Fill, Stroke, Line height, Letter spacing). The prompt adds the CSS name in brackets: "Fill (background)". Rename the font row "Font". Hint copy: "⌥ Click — select the tag, not the component".

- [ ] **19. A 4-option segmented control for variant won't scale** — Low · Effort S · Frame 3
  Four variant names squeezed into about 190px is already tight at 11px. A component with 6 variants, or longer names, will overflow. Meanwhile `size` (also a fixed list) is a dropdown, so the two look unrelated. The plan says variants show as dropdowns.
  *Principle:* consistency and Hick's law. A segmented control is good for 2–3 short options, a dropdown for more.
  *Change:* segmented control for up to 3 short options, otherwise a dropdown. Same rule for every fixed-list prop.

- [x] **20. No quick before/after for one change** — Low · Effort S · Frame 7
  "Hide my changes" hides all of them. To judge one edit (did the new Card fill help?) you have to undo it and redo it. The "focus" target icon on each change row has no label.
  *Principle:* user control and freedom (#3). Comparing is the core of design review.
  *Change:* each change row gets an eye toggle (turn this one off/on). Holding a key (e.g. hold ⌥ on the Changes tab) shows the original. Add tooltips: "Show on page", "Undo".

- [ ] **21. The raw-value field doesn't guard against bad input** — Low · Effort S · Frames 4, 5
  Typing `16` into padding: px or rem? Typing `#ff` into a color? The sketch doesn't show what happens.
  *Principle:* error prevention (#5): constrain the input and say what's wrong right where you typed it.
  *Change:* default unit shown in the field (px). Invalid values get a red outline and a short reason, and aren't applied. As you type a raw value, show the nearest token as a one-click suggestion (the prompt already does this; do it in the picker too).
