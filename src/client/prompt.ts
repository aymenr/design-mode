import { propValue, type Change } from './overrides'
import { PROPS, type Value } from './properties'
import { componentsNamed, fileLine, srcOf } from './source'
import type { LayerTree } from './tree'

/**
 * The prompt you paste into your coding agent: every change, with where it is in the code, what
 * it was and what it should become, and how far it should reach.
 *
 * Written for a reader who has the code but not the page: values are given the way
 * the code writes them (token names, Tailwind classes) next to what they come out as.
 */
export function buildPrompt(changes: Change[], tree: LayerTree): string {
  const active = changes.filter((c) => c.enabled)
  if (active.length === 0) return ''

  // One numbered item per place in the code, so edits to the same spot read together.
  const groups = new Map<string, { heading: string; lines: string[] }>()
  for (const change of active) {
    const { location, heading, line } = describe(change, tree, active)
    // Edits to the same element at the same place read as one item; wider scopes stand alone.
    const key = `${location}\u0000${change.scope.kind === 'type' || change.scope.kind === 'default' || change.kind === 'style' && change.scope.kind === 'line' ? heading : change.nodeId}`
    const group = groups.get(key) ?? { heading: location ? `${location} — ${heading}` : heading, lines: [] }
    group.lines.push(line)
    groups.set(key, group)
  }

  const items = [...groups.values()].map((g, i) => `${i + 1}. ${g.heading}\n${g.lines.map((l) => `   - ${l}`).join('\n')}`)
  return [
    'Apply these design changes. I made them live in Design Mode, an inspector running on the app in dev; they are not in the code yet.',
    'Each item says where it is in the code, what it was, what it should become, and how far it should reach. Prefer the app\'s tokens and Tailwind classes over hard-coded values, and keep anything not listed as it is.',
    '',
    ...items.flatMap((item) => [item, '']),
  ]
    .join('\n')
    .trimEnd()
}

function describe(change: Change, tree: LayerTree, all: Change[]): { location: string; heading: string; line: string } {
  const label = `<${change.nodeName}>`
  const text = labelFor(change, tree, all)
  const heading = `${label}${text ? ` "${text}"` : ''}`

  if (change.kind === 'text') {
    return {
      location: fileLine(change.src),
      heading,
      line: `Text: "${change.before.css}" → "${change.after.css}"${textSourceNote(change)}`,
    }
  }

  if (change.kind === 'prop') {
    const prop = change.propName!
    const from = formatProp(propValue(change.before))
    const to = formatProp(propValue(change.after))
    switch (change.scope.kind) {
      case 'instance':
        return {
          location: fileLine(change.src),
          heading,
          line: `${prop}: ${from} → ${to}, for this one only. This line draws several ${label}s (a list), so this needs a condition that picks out this one.`,
        }
      case 'line':
        return { location: fileLine(change.src), heading, line: `${prop}: ${from} → ${to}${change.scope.label.startsWith('All') ? `, for all of them (${change.scope.label.toLowerCase()})` : ''}` }
      case 'type': {
        const seen = placesUsed(change, tree)
        return {
          location: '',
          heading: `Every ${label} whose ${prop} is ${from}`,
          line: `${prop}: ${from} → ${to}, everywhere ${label} is used with ${prop} ${from}${from === formatProp(change.propDefault ?? null) ? ' (including where it isn\'t set, since that\'s the default)' : ''}. Find every use in the code${seen ? `; on screen it was used at ${seen}` : ''}.`,
        }
      }
      case 'default':
        return {
          location: fileLine(change.definition ?? null),
          heading: `${label}'s default`,
          line: `Change the default of ${prop} from ${from} to ${to}. Every ${label} that doesn't set ${prop} picks this up; ones that set it keep their value.`,
        }
    }
  }

  // A style.
  const def = PROPS.find((p) => p.key === change.propKey)
  const name = `${change.label} (${change.cssProperty})`
  const values = `${formatValue(change.before, def?.kind)} → ${formatValue(change.after, def?.kind)}`
  const classes = classHint(change)
  if (change.scope.kind === 'line') {
    return {
      location: fileLine(change.scope.src ?? null),
      heading: change.nodeKind === 'component' ? `every ${label} (the element ${label} draws here)` : `every ${label} written here`,
      line: `${name}: ${values}${classes}`,
    }
  }
  const inside = change.nodeKind === 'component' && change.before.source?.selector ? ` The style is set inside ${label} itself, so change it for this use only (e.g. through a className or prop passed here), not for every ${label}.` : ''
  return { location: fileLine(change.src), heading, line: `${name}: ${values}${classes}, for this one only.${inside}`.replace(/\.\./g, '.') }
}

/** The text a changed node shows, to tell it apart from its neighbours ("Practice"). As written in the code, before any text edit. */
function labelFor(change: Change, tree: LayerTree, all: Change[]): string {
  const edited = all.find((c) => c.kind === 'text' && c.nodeId === change.nodeId)
  const node = tree.byId.get(change.nodeId)
  const text = edited?.before.css ?? (node?.children[0]?.element ?? node?.element)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  return text.length > 0 && text.length <= 30 ? text : ''
}

function textSourceNote(change: Change): string {
  return change.nodeKind === 'tag' ? '. If this text comes from data rather than the code, say so instead of changing the data.' : ''
}

/** A value as the code would write it, with what it comes out as when that helps. */
function formatValue(value: Value, kind: string | undefined): string {
  if (value.token) return `--${value.token}`
  const display = value.display || 'none'
  const unit = (kind === 'length' || kind === 'box') && /^-?[\d.]+( · -?[\d.]+)*$/.test(display) ? 'px' : ''
  const shown = unit ? display.split(' · ').map((d) => `${d}px`).join(' ') : display
  if (value.level === 'raw') return `${shown} (hard-coded)`
  // A scale step picked by name already says it ("text-2xl"); one shown as a number gets its CSS.
  if (value.level === 'scale' && value.css.includes('var(') && /^[\d.]/.test(shown)) return `${shown} (${value.css})`
  return shown
}

/** "(class bg-card → bg-drawer)" when the change maps onto a Tailwind class swap, or "(set by class bg-card)". */
function classHint(change: Change): string {
  const source = change.before.source
  if (!source?.selector || !source.layer?.endsWith('utilities')) return ''
  const before = source.selector.replace(/^\./, '').replace(/\\(.)/g, '$1').split(/[\s:,>]/)[0]
  if (!before) return ''
  const after = swapClass(before, change.before, change.after)
  return after ? ` (class ${before} → ${after})` : ` (set by class ${before})`
}

/**
 * Works out the new Tailwind class from the old one: `bg-card` with the token changing
 * from color-card to color-drawer becomes `bg-drawer`; `px-4` with the spacing step
 * going from 4 to 5 becomes `px-5`; `text-sm` going to text-2xl becomes `text-2xl`.
 */
function swapClass(before: string, from: Value, to: Value): string | null {
  const suffix = (css: string) => {
    const token = css.match(/var\(--([\w-]+)/)?.[1]
    if (!token) return null
    const step = css.match(/var\(--spacing\)\s*\*\s*([\d.]+)/)?.[1]
    if (step) return step
    return token.replace(/^(color|radius|font-weight|font|text|leading|tracking|shadow|blur|spacing)-/, '')
  }
  const b = suffix(to.css)
  if (!b) return null
  // A one-off class (`text-[16px]`) swaps its bracket for the named step.
  const arbitrary = before.match(/^(.*-)\[[^\]]*\]$/)
  if (arbitrary) return `${arbitrary[1]}${b}`
  const a = suffix(from.css)
  if (!a || !before.endsWith(`-${a}`)) return null
  return `${before.slice(0, -a.length)}${b}`
}

function formatProp(value: unknown): string {
  if (value === null || value === undefined) return 'not set'
  return typeof value === 'string' ? `"${value}"` : String(value)
}

/** Where the component was seen being used on screen, as a hint for finding every use. */
function placesUsed(change: Change, tree: LayerTree): string {
  const places = new Set<string>()
  for (const node of componentsNamed(tree, change.nodeName)) {
    const src = fileLine(srcOf(node))
    if (src) places.add(src)
  }
  const list = [...places]
  return list.length > 6 ? `${list.slice(0, 6).join(', ')} and ${list.length - 6} more` : list.join(', ')
}
