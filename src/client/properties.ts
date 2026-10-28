import { declarationFor, type Declaration } from './cascade'
import { resolveVar, type Tokens } from './tokens'

/**
 * The visual properties the panel shows, in Figma's words, and how to read, classify
 * and offer values for each.
 */

/**
 * - `token`: one of the app's own design tokens.
 * - `scale`: a step on Tailwind's built-in scale (`px-4`, `text-sm`).
 * - `raw`: a one-off value written straight in (`h-[50px]`, an inline style, a hex in a stylesheet).
 * - `none`: nothing set (or only a keyword like `auto`).
 */
export type Level = 'token' | 'scale' | 'raw' | 'none'

export type GroupKey = 'layout' | 'typography' | 'fill' | 'effects'

export const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'layout', label: 'Layout' },
  { key: 'typography', label: 'Typography' },
  { key: 'fill', label: 'Fill and stroke' },
  { key: 'effects', label: 'Effects' },
]

type Kind = 'length' | 'box' | 'color' | 'font' | 'number' | 'keyword' | 'shadow' | 'blur'

export interface PropDef {
  key: string
  label: string
  group: GroupKey
  /** The CSS property an override writes. */
  write: string
  /** For each longhand, every way it can be written, most specific first. */
  read: string[][]
  /** The longhands to read final values from. */
  computed: string[]
  kind: Kind
  /** Comes from the parent when not set on the element itself. */
  inherited?: boolean
  /** Which named values the picker offers: names starting with one of these. */
  prefixes?: string[]
  /** Names to leave out even when the prefix matches. */
  exclude?: RegExp
  keywords?: string[]
  /** Only shown when this is true for the element (alignment only means something in flex and grid). */
  when?: (style: CSSStyleDeclaration) => boolean
}

const SIDES = ['top', 'right', 'bottom', 'left'] as const
const LOGICAL: Record<(typeof SIDES)[number], [string, string]> = {
  top: ['block-start', 'block'],
  right: ['inline-end', 'inline'],
  bottom: ['block-end', 'block'],
  left: ['inline-start', 'inline'],
}

/** The four sides of padding or margin, each with its logical and shorthand spellings. */
function boxSides(base: string): Pick<PropDef, 'read' | 'computed'> {
  return {
    read: SIDES.map((side) => [`${base}-${side}`, `${base}-${LOGICAL[side][0]}`, `${base}-${LOGICAL[side][1]}`, base]),
    computed: SIDES.map((side) => `${base}-${side}`),
  }
}

function borderSides(part: 'width' | 'color'): Pick<PropDef, 'read' | 'computed'> {
  return {
    read: SIDES.map((side) => [
      `border-${side}-${part}`,
      `border-${LOGICAL[side][0]}-${part}`,
      `border-${LOGICAL[side][1]}-${part}`,
      `border-${part}`,
      `border-${side}`,
      'border',
    ]),
    computed: SIDES.map((side) => `border-${side}-${part}`),
  }
}

const CORNERS = [
  ['top-left', 'start-start'],
  ['top-right', 'start-end'],
  ['bottom-right', 'end-end'],
  ['bottom-left', 'end-start'],
]

const isFlexOrGrid = (s: CSSStyleDeclaration) => /flex|grid/.test(s.display)

export const PROPS: PropDef[] = [
  { key: 'width', label: 'Width', group: 'layout', write: 'width', read: [['width']], computed: ['width'], kind: 'length', prefixes: ['--spacing-', '--container-'] },
  { key: 'height', label: 'Height', group: 'layout', write: 'height', read: [['height']], computed: ['height'], kind: 'length', prefixes: ['--spacing-'] },
  { key: 'padding', label: 'Padding', group: 'layout', write: 'padding', ...boxSides('padding'), kind: 'box', prefixes: ['--spacing-'] },
  { key: 'margin', label: 'Margin', group: 'layout', write: 'margin', ...boxSides('margin'), kind: 'box', prefixes: ['--spacing-'] },
  { key: 'gap', label: 'Gap', group: 'layout', write: 'gap', read: [['row-gap', 'gap'], ['column-gap', 'gap']], computed: ['row-gap', 'column-gap'], kind: 'length', prefixes: ['--spacing-'], when: isFlexOrGrid },
  { key: 'align', label: 'Align items', group: 'layout', write: 'align-items', read: [['align-items']], computed: ['align-items'], kind: 'keyword', keywords: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'], when: isFlexOrGrid },
  { key: 'justify', label: 'Justify', group: 'layout', write: 'justify-content', read: [['justify-content']], computed: ['justify-content'], kind: 'keyword', keywords: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'], when: isFlexOrGrid },

  { key: 'font', label: 'Font', group: 'typography', write: 'font-family', read: [['font-family', 'font']], computed: ['font-family'], kind: 'font', inherited: true, prefixes: ['--font-'], exclude: /^--font-weight-/ },
  { key: 'size', label: 'Size', group: 'typography', write: 'font-size', read: [['font-size', 'font']], computed: ['font-size'], kind: 'length', inherited: true, prefixes: ['--text-'], exclude: /--(line-height|letter-spacing|font-weight)$/ },
  { key: 'weight', label: 'Weight', group: 'typography', write: 'font-weight', read: [['font-weight', 'font']], computed: ['font-weight'], kind: 'number', inherited: true, prefixes: ['--font-weight-'] },
  { key: 'line', label: 'Line height', group: 'typography', write: 'line-height', read: [['line-height', 'font']], computed: ['line-height'], kind: 'length', inherited: true, prefixes: ['--leading-'] },
  { key: 'tracking', label: 'Letter spacing', group: 'typography', write: 'letter-spacing', read: [['letter-spacing']], computed: ['letter-spacing'], kind: 'length', inherited: true, prefixes: ['--tracking-'] },
  { key: 'color', label: 'Color', group: 'typography', write: 'color', read: [['color']], computed: ['color'], kind: 'color', inherited: true, prefixes: ['--color-'] },

  { key: 'fill', label: 'Fill', group: 'fill', write: 'background-color', read: [['background-color', 'background']], computed: ['background-color'], kind: 'color', prefixes: ['--color-'] },
  { key: 'stroke', label: 'Stroke', group: 'fill', write: 'border-color', ...borderSides('color'), kind: 'color', prefixes: ['--color-'] },
  { key: 'strokeWidth', label: 'Stroke width', group: 'fill', write: 'border-width', ...borderSides('width'), kind: 'box' },
  {
    key: 'radius',
    label: 'Radius',
    group: 'fill',
    write: 'border-radius',
    read: CORNERS.map(([corner, logical]) => [`border-${corner}-radius`, `border-${logical}-radius`, 'border-radius']),
    computed: CORNERS.map(([corner]) => `border-${corner}-radius`),
    kind: 'box',
    prefixes: ['--radius-'],
  },

  { key: 'opacity', label: 'Opacity', group: 'effects', write: 'opacity', read: [['opacity']], computed: ['opacity'], kind: 'number' },
  { key: 'shadow', label: 'Shadow', group: 'effects', write: 'box-shadow', read: [['box-shadow']], computed: ['box-shadow'], kind: 'shadow', prefixes: ['--shadow-'] },
  { key: 'blur', label: 'Blur', group: 'effects', write: 'filter', read: [['filter']], computed: ['filter'], kind: 'blur', prefixes: ['--blur-'] },
]

export interface Value {
  /** The CSS that produced it (as written), or that an override writes. */
  css: string
  /** What the field shows. */
  display: string
  level: Level
  /** The token's name without `--`, when `level` is token. */
  token: string | null
  /** A color to show as a swatch, for color properties. */
  swatch: string | null
  inherited: boolean
  /** The declaration it came from, kept for the Claude prompt (which class to swap). */
  source: Declaration | null
}

const KEYWORD = /^(auto|none|normal|inherit|initial|unset|revert|0|0px|transparent|currentcolor|fit-content|max-content|min-content)$/i

/** Reads one property of an element: its final value, plus where that value came from. */
export function readValue(element: Element, def: PropDef, tokens: Tokens): Value {
  const style = getComputedStyle(element)
  const computed = def.computed.map((p) => style.getPropertyValue(p).trim())

  let declarations = def.read.map((names) => declarationFor(element, names))
  let inherited = false
  if (def.inherited && declarations.every((d) => !d)) {
    for (let parent = element.parentElement, i = 0; parent && i < 20; parent = parent.parentElement, i++) {
      const found = declarationFor(parent, def.read[0])
      if (found) {
        declarations = [found]
        inherited = true
        break
      }
    }
  }

  const levels = declarations.map((d) => classify(d, tokens))
  const level = (['raw', 'token', 'scale'] as const).find((l) => levels.some((x) => x.level === l)) ?? 'none'
  const token = level === 'token' ? (levels.find((x) => x.level === 'token')?.token ?? null) : null
  const source = declarations.find((d, i) => d && levels[i].level === level) ?? null

  return {
    css: source?.value ?? computed.join(' '),
    display: token ? token.slice(2) : formatComputed(def, computed),
    level,
    token: token ? token.slice(2) : null,
    swatch: def.kind === 'color' ? computed[0] : null,
    inherited,
    source,
  }
}

function classify(decl: Declaration | null, tokens: Tokens): { level: Level; token: string | null } {
  if (!decl) return { level: 'none', token: null }
  const vars = [...decl.value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])
  const app = vars.find((v) => tokens.appNames.has(v))
  if (app) return { level: 'token', token: app }
  if (vars.length > 0) return { level: 'scale', token: null }
  if (KEYWORD.test(decl.value)) return { level: 'none', token: null }
  if (decl.selector === null) return { level: 'raw', token: null }
  // A Tailwind class with a fixed value (`border`, `opacity-50`) is still a scale step.
  // One written in brackets (`h-[50px]`) is a one-off.
  if (decl.layer?.endsWith('utilities') && !decl.selector.includes('\\[')) return { level: 'scale', token: null }
  return { level: 'raw', token: null }
}

/** What a newly picked or typed value is: a token, a scale step, or raw. */
export function valueFromCss(def: PropDef, css: string, display: string, tokens: Tokens): Value {
  const vars = [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])
  const app = vars.find((v) => tokens.appNames.has(v))
  const level: Level = app ? 'token' : vars.length > 0 ? 'scale' : KEYWORD.test(css) || def.kind === 'keyword' ? 'none' : 'raw'
  return {
    css,
    display: app ? app.slice(2) : display,
    level,
    token: app ? app.slice(2) : null,
    swatch: def.kind === 'color' ? resolveColor(css) : null,
    inherited: false,
    source: null,
  }
}

function formatComputed(def: PropDef, values: string[]): string {
  if (def.kind === 'color') return colorName(values[0])
  if (def.kind === 'font') return values[0].split(',')[0].replace(/["']/g, '').trim()
  const short = values.map(shortLength)
  if (def.kind === 'box' || values.length > 1) return compressSides(short)
  return short[0]
}

/** `16px` → `16`, `0.5px` → `0.5`. Leaves anything that isn't a plain px length alone. */
function shortLength(value: string): string {
  const px = value.match(/^(-?[\d.]+)px$/)
  return px ? String(Math.round(parseFloat(px[1]) * 100) / 100) : value
}

/** Four sides as Figma would say them: `16`, `0 · 16` (top/bottom · sides), or all four. */
function compressSides(v: string[]): string {
  if (v.length === 2) return v[0] === v[1] ? v[0] : `${v[0]} · ${v[1]}`
  if (v.length !== 4) return v.join(' ')
  if (v.every((x) => x === v[0])) return v[0]
  if (v[0] === v[2] && v[1] === v[3]) return `${v[0]} · ${v[1]}`
  return v.join(' ')
}

/** `rgb(53, 51, 50)` → `#353332`; fully transparent → `none`. */
export function colorName(value: string): string {
  // Newer color spaces (Tailwind's `bg-white/10` comes out as `oklab(…)`) have no
  // short hex form of their own; paint one pixel and read back plain RGB instead.
  if (/^(oklab|oklch|lab|lch|color|hwb|hsl)\(/.test(value)) value = viaCanvas(value) ?? value
  const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/)
  if (!m) return value
  const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  if (alpha === 0) return 'none'
  const hex = `#${[m[1], m[2], m[3]].map((c) => Math.round(parseFloat(c)).toString(16).padStart(2, '0')).join('')}`
  return alpha < 1 ? `${hex} ${Math.round(alpha * 100)}%` : hex
}

let pixel: CanvasRenderingContext2D | null = null
function viaCanvas(color: string): string | null {
  pixel ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })
  if (!pixel) return null
  pixel.clearRect(0, 0, 1, 1)
  pixel.fillStyle = color
  pixel.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`
}

let probe: HTMLElement | null = null
/** The color a CSS value comes out as (resolving any variables), for swatches. */
export function resolveColor(css: string): string {
  probe ??= Object.assign(document.createElement('span'), { hidden: true })
  if (!probe.isConnected) document.documentElement.append(probe)
  probe.style.color = ''
  probe.style.color = css
  return getComputedStyle(probe).color
}

export interface Option {
  label: string
  css: string
  /** What it comes out as, shown on the right: `#353332`, `16px`. */
  preview: string
  level: 'token' | 'scale' | 'none'
  group: string
  swatch: string | null
}

/** Tailwind's spacing steps, offered as the scale for sizes, padding, margin and gap. */
const SPACING_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]

/** What the picker offers for a property: the app's tokens first, then the scale. */
export function optionsFor(def: PropDef, tokens: Tokens): Option[] {
  const options: Option[] = []
  const named = (name: string) =>
    !!def.prefixes?.some((p) => name.startsWith(p)) && !(def.exclude && def.exclude.test(name))
  // An app without Tailwind's `--color-*` names (`--blue`, `--text`): any variable that
  // holds a color counts as a color token.
  const byValue = def.kind === 'color' && ![...tokens.app.map((t) => t.name), ...tokens.scaleNames].some(named)
  const matches = (name: string) => named(name) || (byValue && isColorValue(resolveVar(name)))
  const make = (name: string, level: 'token' | 'scale', group: string, themeValue?: string): Option => {
    const resolved = resolveVar(name)
    // Tailwind only puts a token on the page once something uses it. For an unused
    // one, carry its value from the theme as a fallback so picking it still works.
    const css = resolved || !themeValue ? `var(${name})` : `var(${name}, ${themeValue})`
    return {
      label: name.slice(2),
      css,
      preview: def.kind === 'color' ? colorName(resolveColor(css)) : inPx(resolved || (themeValue ?? '')),
      level,
      group,
      swatch: def.kind === 'color' ? resolveColor(css) : null,
    }
  }

  for (const token of tokens.app) {
    if (matches(token.name)) options.push(make(token.name, 'token', token.group ?? 'App tokens', token.value))
  }

  if ((def.kind === 'length' || def.kind === 'box') && tokens.scaleNames.includes('--spacing') && def.prefixes?.includes('--spacing-')) {
    const unit = parseLength(resolveVar('--spacing'))
    for (const step of SPACING_STEPS) {
      options.push({ label: String(step), css: `calc(var(--spacing) * ${step})`, preview: `${round(step * unit)}px`, level: 'scale', group: 'Scale', swatch: null })
    }
  }
  for (const name of tokens.scaleNames) if (matches(name)) options.push(make(name, 'scale', 'Scale'))

  for (const keyword of def.keywords ?? []) {
    options.push({ label: keyword, css: keyword, preview: '', level: 'none', group: 'Options', swatch: null })
  }
  return options
}

function isColorValue(value: string): boolean {
  return !!value && !/^(inherit|initial|unset|currentcolor|transparent)$/i.test(value) && CSS.supports('color', value)
}

/** Turns typed input into CSS: bare numbers become px for lengths, and a number for blur becomes `blur(…px)`. */
export function normalizeInput(def: PropDef, input: string): string {
  const text = input.trim()
  if (def.kind === 'length' || def.kind === 'box') return text.replace(/(^|\s)(-?[\d.]+)(?=\s|$)/g, (_, space, n) => `${space}${n}px`)
  if (def.kind === 'blur' && /^[\d.]+$/.test(text)) return `blur(${text}px)`
  return text
}

/** `0.25rem` → 4 (px at the page's root font size). */
function parseLength(value: string): number {
  const n = parseFloat(value)
  if (value.endsWith('rem')) return n * parseFloat(getComputedStyle(document.documentElement).fontSize)
  return n
}

const round = (n: number) => Math.round(n * 100) / 100

/** `1.125rem` → `18px`, the unit the rest of the panel speaks in. */
function inPx(value: string): string {
  return /^-?[\d.]+rem$/.test(value) ? `${round(parseLength(value))}px` : value
}

/** A short summary of a group's main values, for its collapsed header. */
export function summaryValue(value: Value): string {
  return value.level === 'none' ? '' : value.token ? `◇ ${value.token}` : value.display
}
