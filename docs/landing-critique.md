# Landing page critique: designmode.thelycheestudio.com

Reviewed live on 2026-10-28 at 1280×800 (desktop) and 375×812 (phone).
Findings are ranked by impact: how many visitors hit the problem, and how much it costs them.
"Applied" or "Skipped" after each one says what happened to it.

## What already works

- The page runs the real tool on itself. That is the strongest possible demo and trust signal: nobody has to take the claims on faith.
- The hero mock panel shows the actual product (variants, tokens, "raw" values, the Changes count), not a stock illustration.
- The sample prompt section shows the output, not just describes it.
- No horizontal scroll at 375px, readable line lengths, a consistent 88px section rhythm.

---

## 1. The "Try it" callout covers the page on phones

**Problem.** At 375px the blue callout ("Try it right here") sits on top of the "Install in two steps" button and the hero's small print. It stays pinned to the bottom of the screen while you scroll, so it then covers step cards, the sample prompt and the tables.

**Why it matters.** It hides the second call to action at the exact moment a visitor is deciding, and then obstructs reading for the whole visit. Nielsen's "user control and freedom": the only way out is to find and tap a small ✕.

**Fix.** Make the callout a compact one-line pill that sits *beside* the tool's button instead of above it, so it never reaches the hero content. Hide it once the visitor scrolls past the first screen; the pulsing ring alone keeps pointing at the button. — **Applied**

## 2. The callout sometimes never appears, or points at the wrong spot

**Problem.** The page positions the callout two frames after the tool loads. If the tool's button isn't drawn yet, the callout hides itself and nothing ever re-checks, so on some loads (seen on desktop) there is no callout at all. After a window resize it can also be placed against the button's *old* position, off-screen.

**Why it matters.** The live demo is the page's best selling point, and the callout is how first-time visitors discover it.

**Fix.** Keep re-checking each frame until the button exists (with a cap), and re-place on resize and scroll one frame later, after the tool has moved its button. — **Applied**

## 3. The copy describes a button that doesn't exist

**Problem.** The hero small print says "press the **blue** button bottom right"; the steps and the Controls table say "the **round** button". The real button is a dark-gray pill with a cursor icon.

**Why it matters.** Nielsen's "match between system and the real world": a visitor looks for a blue circle, doesn't find it, and gives up on the demo.

**Fix.** Describe it as it is: "the cursor button, bottom right". — **Applied**

## 4. Text and buttons fail WCAG AA contrast

**Problem.** WCAG AA asks for a contrast ratio of at least 4.5:1 for normal-size text (contrast ratio compares how light the text is against its background; 1:1 is invisible, 21:1 is black on white).
- The "faint" gray (#75737d) is 4.0:1 on the page and 3.6:1 on cards. It's used for the hero small print, the footer and code comments.
- White text on the brand blue (#4c8dff) is 3.2:1. That's the primary "Try it" button and the callout.

**Why it matters.** Low-vision visitors and anyone on a dim or glare-y screen can't read the reassurance text ("never in a build") or the main button label.

**Fix.** Raise the faint gray to #8e8c96 (5.1–5.9:1 on every surface it sits on). Add a deeper blue (#2b6be6, 4.8:1 with white) for filled buttons and the callout; keep the bright blue for outlines, the logo and the ring, where it isn't behind text. — **Applied**

## 5. The headline is too long to scan in five seconds

**Problem.** The H1 is 15 words and wraps to five lines on both desktop and phone. The "AI agent" half, which is the actual differentiator, lands on lines 4–5.

**Why it matters.** F-pattern reading: people read the first line or two of a heading, then scan down the left edge. Whatever is past line two is mostly not read.

**Fix.** Keep the headline to the hook ("Tweak your running app like it's a *Figma file*.") and move the hand-off into the first words of the paragraph below it ("Then hand the changes to your AI coding agent…"), which is the next thing the eye lands on. Same positioning, half the lines. — **Applied**

## 6. "Who is this for" is implied, not said

**Problem.** The badge says "For React + Vite apps". It names the tech, not the person. The page's real audience (designers who work in code, and developers who polish UI) has to infer it.

**Why it matters.** The first-five-seconds question "is this for me?" should be answered literally.

**Fix.** Badge: "For designers and developers on React + Vite". The "dev only" reassurance moves to the small print under the buttons, where it's explained properly. — **Applied**

## 7. The only GitHub link is a dead end for most visitors

**Problem.** The nav's GitHub link (the only nav item on phones) and the footer link go to a private repository, which shows a 404 to anyone without access.

**Why it matters.** It's the most visible link on mobile and it looks broken. It also wastes the nav's most valuable slot.

**Fix.** Replace it in the nav with a small "Install" button (the action the page actually wants). Keep GitHub in the footer, labelled "(private for now)". — **Applied**

## 8. No call to action at the end of the page

**Problem.** After the Controls and FAQ, the page ends at the footer. A visitor who has read everything, the most convinced kind, has to scroll all the way up to act.

**Why it matters.** Fitts's law is about the distance to a target as much as its size; the end of the page is where intent peaks and the target is furthest away.

**Fix.** A short closing band with the same two buttons: "Try it on this page" and "Install". — **Applied**

## 9. The visible FAQ doesn't match the FAQ in the search data

**Problem.** The page tells search engines (in its hidden structured data) that it has an FAQ with five questions, but on the page those answers sit in a "Good to know" table of topics, and "Does it ship to production?" isn't there at all. The table also has a "Canvas" answer the search data lacks.

**Why it matters.** Google only shows FAQ rich results when the questions are visible on the page, word for word. Questions are also easier to scan than topic labels: they match what the visitor is wondering.

**Fix.** Turn "Good to know" into a real FAQ using the exact questions from the structured data, add "Does it ship to production?", and add the canvas question to the structured data so the two match. — **Applied**

## 10. Heading levels and landmarks are off

**Problem.** "Controls" and "Good to know" are H3s with no H2 above them (the outline jumps from H1 to H3). There's no `<main>` landmark, the nav has no label, tables have no header section, and the feature icons are Unicode symbols that screen readers announce ("white diamond containing black small diamond").

**Why it matters.** Screen-reader users navigate by headings and landmarks; search engines use the outline to understand the page.

**Fix.** Make those two headings H2s (same look), wrap the content in `<main>`, label the nav, add `<thead>` with `scope="col"`, and hide the decorative icons from assistive tech. — **Applied**

## 11. Phone tap targets for the main buttons

**Problem.** At 375px the two hero buttons wrap onto two lines at different widths (one short, one long), which reads as accidental.

**Why it matters.** Gestalt similarity: two equal-rank choices should look equal. Full-width buttons are also easier to hit with a thumb (Fitts's law).

**Fix.** Full-width stacked buttons below 560px. — **Applied**

## 12. Keyboard focus isn't styled

**Problem.** Buttons and links rely on the browser's default focus outline, which is faint on this dark background and missing on some browsers' button styles.

**Why it matters.** Keyboard users need to see where they are (WCAG 2.4.7).

**Fix.** A clear blue `:focus-visible` ring on links and buttons. — **Applied**

## 13. A few terms go undefined

**Problem.** "Tokens" and "raw" are used without explanation. Most React developers know them; many designers on a team adopting this won't call hard-coded values "raw".

**Why it matters.** The page is partly aimed at designers; one undefined word can stop the read.

**Fix.** Define inline on first use: "your design tokens (the named colors and sizes your app defines, like `color-card`)", "a hard-coded one-off ("raw")". — **Applied**

## 14. Small print undersells "dev only"

**Problem.** "It only exists while you run `vite`" assumes the reader knows `vite` is the dev server command.

**Fix.** "In your own app it only runs while the Vite dev server is running, and is never part of a production build." — **Applied**

---

## Skipped, and why

| Idea | Why skipped |
|---|---|
| Testimonials, user counts or company logos | None exist yet. Inventing them would be dishonest; add real ones when there are some. |
| A "Request access" button for the private repo | Needs a real process and contact address behind it (a product decision). Worth adding: today the install card tells people they need access but not how to get it. |
| Saying "free" on the page | The search description says free, but pricing is a positioning call, not a design fix. Left as is. |
| Replacing the Unicode feature icons with a drawn icon set | A visual refresh, not a fix; hiding them from screen readers solves the accessibility part. |
| Changing the tool's own button to blue and round to match the old copy | That changes the product, not the page. The copy was fixed instead. |
| A light theme | The dark look matches the product's panel; not a problem to solve. |
