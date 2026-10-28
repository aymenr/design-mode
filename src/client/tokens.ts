import { allRules } from './cascade'

export interface Token {
  name: string
  /** As written in the theme, e.g. `#353332` or `var(--color-primary)`. */
  value: string
  group: string | null
}

/**
 * The two kinds of named value a page can have:
 * - `app`: the app's own design tokens (from its Tailwind `@theme`, via the plugin).
 * - `scale`: every other custom property on `:root`, which in a Tailwind app is
 *   Tailwind's built-in scale (`--spacing`, `--text-sm`, `--color-white`, …).
 *
 * On a page without a Tailwind theme, everything on `:root` counts as the app's.
 */
export interface Tokens {
  app: Token[]
  appNames: Set<string>
  scaleNames: string[]
}

export async function loadTokens(): Promise<Tokens> {
  let app: Token[] = []
  try {
    const response = await fetch('/@design-mode/tokens.json')
    if (response.ok) app = await response.json()
  } catch {
    // Not served by the plugin (e.g. a plain HTML page). Fall back to :root below.
  }
  const rootNames = rootVariables()
  if (app.length === 0) {
    app = rootNames.map((name) => ({ name, value: resolveVar(name), group: null }))
  }
  const appNames = new Set(app.map((t) => t.name))
  return { app, appNames, scaleNames: rootNames.filter((name) => !appNames.has(name)) }
}

/** Names of the custom properties declared on `:root` (or `:host`, where Tailwind also puts them). */
function rootVariables(): string[] {
  const names = new Set<string>()
  for (const rule of allRules()) {
    if (!/:root|:host|^html\b/.test(rule.selectorText)) continue
    for (let i = 0; i < rule.style.length; i++) {
      const name = rule.style[i]
      // Tailwind's own bookkeeping variables, never a design value.
      if (name.startsWith('--') && !name.startsWith('--tw-')) names.add(name)
    }
  }
  return [...names]
}

/** What a variable comes out as on this page right now, e.g. `#353332`. */
export function resolveVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
