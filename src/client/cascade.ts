/**
 * Finding the CSS that actually set a value on an element.
 *
 * The browser tells you an element's final ("computed") values, like `16px`, but not
 * where they came from. To say whether a value is a token, a Tailwind scale step or a
 * hard-coded one-off, the tool needs the declaration as written, like
 * `calc(var(--spacing) * 4)` from the class `px-4`. So it re-runs a simplified
 * version of the browser's cascade: collect every rule that matches the element and
 * pick the one that wins.
 *
 * Simplified means: inline styles beat unlayered rules, which beat rules in
 * `@layer`s (later layers win), then the more specific selector, then the later
 * rule. `!important` is ignored. That matches how Tailwind and plain CSS
 * are written in practice.
 */
export interface Declaration {
  /** The value as written, e.g. `var(--color-card)`. */
  value: string
  /** The property it was written under (`padding-inline` for a padding-left lookup). */
  property: string
  /** The selector of the winning rule, or null for an inline style. */
  selector: string | null
  /** The cascade layer it sits in (`utilities` for Tailwind classes), or null. */
  layer: string | null
}

export interface FlatRule {
  selectorText: string
  style: CSSStyleDeclaration
  layer: string | null
  layerRank: number
  order: number
}

/** Our own stylesheets, which must not count as the app's styles. */
export const OVERRIDE_SHEET_ID = 'design-mode-overrides'
export const FORCE_SHEET_ID = 'design-mode-force'

let cache: { rules: FlatRule[]; at: number } | null = null
const CACHE_MS = 1000

export function invalidateRules() {
  cache = null
}

export function allRules(): FlatRule[] {
  if (cache && performance.now() - cache.at < CACHE_MS) return cache.rules
  const rules: FlatRule[] = []
  const layerOrder: string[] = []
  const rankOf = (layer: string) => {
    if (!layerOrder.includes(layer)) layerOrder.push(layer)
    return layerOrder.indexOf(layer)
  }

  const walk = (list: CSSRuleList, layer: string | null) => {
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSStyleRule) {
        rules.push({ selectorText: rule.selectorText, style: rule.style, layer, layerRank: layer ? rankOf(layer) : 0, order: rules.length })
        // Nested rules (`&:hover { … }`) are rare in built CSS; their selectors resolve on their own.
        if (rule.cssRules?.length) walk(rule.cssRules, layer)
      } else if (rule instanceof CSSLayerStatementRule) {
        for (const name of rule.nameList) rankOf(layer ? `${layer}.${name}` : name)
      } else if (rule instanceof CSSLayerBlockRule) {
        const name = layer ? `${layer}.${rule.name}` : rule.name
        rankOf(name)
        walk(rule.cssRules, name)
      } else if (rule instanceof CSSMediaRule) {
        if (window.matchMedia(rule.conditionText).matches) walk(rule.cssRules, layer)
      } else if (rule instanceof CSSSupportsRule) {
        if (CSS.supports(rule.conditionText)) walk(rule.cssRules, layer)
      }
    }
  }

  for (const sheet of Array.from(document.styleSheets)) {
    const id = (sheet.ownerNode as Element | null)?.id
    if (id === OVERRIDE_SHEET_ID || id === FORCE_SHEET_ID) continue
    try {
      walk(sheet.cssRules, null)
    } catch {
      // A stylesheet from another origin can't be read. Skip it.
    }
  }
  cache = { rules, at: performance.now() }
  return rules
}

/**
 * The winning declaration for any of `properties` on an element. `properties` lists
 * every way the value could be written, most specific first, e.g. for padding-left:
 * `padding-left`, `padding-inline-start`, `padding-inline`, `padding`.
 */
export function declarationFor(element: Element, properties: string[]): Declaration | null {
  const inline = (element as HTMLElement).style
  if (inline) {
    for (const property of properties) {
      const value = inline.getPropertyValue(property)
      if (value) return { value, property, selector: null, layer: null }
    }
  }

  let best: { decl: Declaration; key: number[] } | null = null
  for (const { rule, key } of matchedRules(element)) {
    let value = ''
    let property = ''
    for (const p of properties) {
      value = rule.style.getPropertyValue(p)
      if (value) {
        property = p
        break
      }
    }
    if (!value) continue
    if (!best || compare(key, best.key) > 0) {
      best = { decl: { value: value.trim(), property, selector: rule.selectorText, layer: rule.layer }, key }
    }
  }
  return best?.decl ?? null
}

/**
 * The rules that match an element, each with its cascade rank. Worked out once per
 * element and kept until the rules are re-read, since the panel asks about twenty
 * properties of the same element at once.
 */
let matchCache = new WeakMap<Element, { rule: FlatRule; key: number[] }[]>()
let matchCacheRules: FlatRule[] | null = null

function matchedRules(element: Element): { rule: FlatRule; key: number[] }[] {
  const rules = allRules()
  if (rules !== matchCacheRules) {
    matchCache = new WeakMap()
    matchCacheRules = rules
  }
  let matched = matchCache.get(element)
  if (!matched) {
    matched = []
    for (const rule of rules) {
      const specificity = matchingSpecificity(element, rule.selectorText)
      // Unlayered rules outrank every layer.
      if (specificity) matched.push({ rule, key: [rule.layer ? 0 : 1, rule.layerRank, ...specificity, rule.order] })
    }
    matchCache.set(element, matched)
  }
  return matched
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

/** The specificity of the most specific part of a selector list that matches, or null if none does. */
function matchingSpecificity(element: Element, selectorText: string): [number, number, number] | null {
  let best: [number, number, number] | null = null
  for (const part of splitSelectors(selectorText)) {
    if (part.includes('::')) continue
    let matches = false
    try {
      matches = element.matches(part)
    } catch {
      continue
    }
    if (!matches) continue
    const s = specificity(part)
    if (!best || compare(s, best) > 0) best = s
  }
  return best
}

function splitSelectors(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\\') {
      current += ch + (text[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/** A close-enough selector specificity: (ids, classes/attributes/pseudo-classes, tags). */
function specificity(selector: string): [number, number, number] {
  // Tailwind escapes `:` and `[` inside class names (`.hover\:bg-x`), so drop escapes first.
  const s = selector.replace(/\\./g, 'x').replace(/:where\([^)]*\)/g, '')
  const ids = (s.match(/#[\w-]+/g) ?? []).length
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length
  const tags = (s.match(/(?:^|[\s>+~(])([a-z][\w-]*)/gi) ?? []).length
  return [ids, classes, tags]
}
