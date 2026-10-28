import { OVERRIDE_SHEET_ID } from './cascade'
import { overrideProp, setPropRules, type PropRule } from './liveProps'
import type { Value } from './properties'
import { componentsNamed, srcOf } from './source'
import { hostsOf, type LayerNode, type LayerTree } from './tree'

/**
 * Who an edit applies to.
 * - `instance`: just the one you selected.
 * - `line`: everything one line of code draws (all three cards from a list), or
 *   for a style, every element written at the same place (so for a component's
 *   own element, every instance of that component).
 * - `type`: every component with this name whose prop had the same value.
 * - `default`: every component with this name that doesn't set the prop, i.e. a
 *   change to the component's default.
 */
export type ScopeKind = 'instance' | 'line' | 'type' | 'default'

export interface Scope {
  kind: ScopeKind
  /** What the chip says: "Only this one", "Every Card". */
  label: string
  /** What it means for the code: "edits kit/Card.tsx:36". */
  detail: string
  /** For `line`: the source location everything in scope shares. */
  src?: string
}

/** One edit you made, kept until you undo or discard it. */
export interface Change {
  id: number
  kind: 'style' | 'text' | 'prop'
  /** Which layer it applies to, by its path in the tree, so it survives the tree being rebuilt. */
  nodeId: string
  nodeName: string
  nodeKind: LayerNode['kind']
  /** Where it sits, e.g. `LibraryScreen › UploadCard`. */
  path: string
  /** Where the edited thing is written: a component's call site, or the element's own line for a style. */
  src: string | null
  /** `fill`, `text`, `prop:variant`… one change per node and key. */
  propKey: string
  /** Figma's word for a style (Fill, Padding), `Text`, or the prop's name. */
  label: string
  /** The CSS property a style edit overrides. */
  cssProperty: string | null
  /** The prop a prop edit changes. */
  propName: string | null
  /** A prop's default, from the component's types, for "every one that doesn't set it". */
  propDefault?: unknown
  /** Where the component is defined (from its types), for "change the default". */
  definition?: string | null
  before: Value
  after: Value
  scope: Scope
  /** Off means kept in the list but not shown on the page, to compare before and after. */
  enabled: boolean
}

/** The element a node's styles are read from and written to: the tag itself, or a component's first element. */
export function styleTarget(node: LayerNode): Element | null {
  return hostsOf(node)[0] ?? null
}

/**
 * The text a node shows, when it shows exactly one piece of text. Anything with more
 * than one (a card with a title and a subtitle) has no single text to edit; select
 * the part you want instead.
 */
export function textNodeOf(node: LayerNode): Text | null {
  const hosts = hostsOf(node)
  if (hosts.length !== 1) return null
  const walker = document.createTreeWalker(hosts[0], NodeFilter.SHOW_TEXT, {
    acceptNode: (t) => ((t as Text).data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  })
  const first = walker.nextNode() as Text | null
  return first && !walker.nextNode() ? first : null
}

/** A prop value as stored in a change (`css` holds it as JSON). */
export function propValue(value: Value): unknown {
  try {
    return JSON.parse(value.css)
  } catch {
    return value.css
  }
}

/**
 * Puts edits on the page without touching the app's code.
 *
 * - Styles go into one stylesheet the tool owns, as `!important` rules. "Only this
 *   one" targets a `data-dm` attribute stamped on that element; wider scopes target
 *   the `data-dm-src` every element written at that place shares.
 * - Text is replaced directly; the original is kept so turning an edit off puts it back.
 * - Props go through the rules in liveProps, plus React's `overrideProps` so they
 *   show up now rather than at the next re-render.
 *
 * `apply` is idempotent and cheap when nothing changed, because it runs after every
 * rebuild of the tree: React can replace an element or re-render it at any time,
 * and this puts the edit back.
 */
export class Overrides {
  private sheet: HTMLStyleElement
  private keys = new WeakMap<Element, string>()
  private nextKey = 1
  private texts = new Map<Text, string>()

  constructor() {
    this.sheet = document.createElement('style')
    this.sheet.id = OVERRIDE_SHEET_ID
    document.head.append(this.sheet)
  }

  apply(changes: Change[], tree: LayerTree, hidden: boolean) {
    const active = hidden ? [] : changes.filter((c) => c.enabled)
    const rules: string[] = []
    const wantedTexts = new Map<Text, string>()
    const propRules: PropRule[] = []

    for (const change of active) {
      const node = tree.byId.get(change.nodeId)
      if (change.kind === 'style' && change.cssProperty) {
        const declaration = `${change.cssProperty}: ${change.after.css} !important;`
        if (change.scope.kind === 'line' && change.scope.src) {
          rules.push(`[data-dm-src="${CSS.escape(change.scope.src)}"] { ${declaration} }`)
        } else {
          const element = node ? styleTarget(node) : null
          if (element) rules.push(`[data-dm="${this.keyFor(element)}"] { ${declaration} }`)
        }
      } else if (change.kind === 'text') {
        const text = node ? (textNodeOf(node) ?? this.findEdited(node)) : null
        if (text) wantedTexts.set(text, change.after.css)
      } else if (change.kind === 'prop' && change.propName) {
        const rule = propRule(change)
        if (rule) propRules.push(rule)
      }
    }

    // Put back any text no longer edited, then write the edited ones.
    for (const [text, original] of this.texts) {
      if (!wantedTexts.has(text)) {
        if (text.data !== original) text.data = original
        this.texts.delete(text)
      }
    }
    for (const [text, value] of wantedTexts) {
      if (!this.texts.has(text)) this.texts.set(text, text.data)
      if (text.data !== value) text.data = value
    }

    const css = rules.join('\n')
    if (this.sheet.textContent !== css) this.sheet.textContent = css
    if (!this.sheet.isConnected) document.head.append(this.sheet)

    setPropRules(propRules)
    for (const change of active) if (change.kind === 'prop') this.pushProp(change, tree, false)
  }

  /** Takes prop edits off the page right away (otherwise they'd linger until the component's parent re-renders). */
  revertProps(changes: Change[], tree: LayerTree) {
    for (const change of changes) if (change.kind === 'prop') this.pushProp(change, tree, true)
  }

  /**
   * Re-renders the components a prop edit covers with the new value (or, reverting,
   * the old one). The rules make the edit stick from the parent's next render on;
   * this makes it visible now.
   */
  private pushProp(change: Change, tree: LayerTree, revert: boolean) {
    const prop = change.propName!
    const before = propValue(change.before)
    const after = propValue(change.after)
    const [from, to] = revert ? [after, before] : [before, after]
    const node = tree.byId.get(change.nodeId)

    let targets: LayerNode[] = []
    if (change.scope.kind === 'instance') targets = node ? [node] : []
    else if (change.scope.kind === 'line') targets = [...tree.byId.values()].filter((n) => n.kind === 'component' && srcOf(n) === change.scope.src)
    else targets = componentsNamed(tree, change.nodeName)

    for (const target of targets) {
      const props = target.fiber?.memoizedProps
      if (!target.fiber || !props) continue
      const current = props[prop] === undefined ? (change.propDefault ?? null) : props[prop]
      if (current === to) continue
      // For the wider scopes, only touch the ones that had the value being replaced.
      if (change.scope.kind === 'type' || change.scope.kind === 'default') {
        if (current !== from) continue
      }
      // `null` stands for "not set": pass undefined so the component's own default applies.
      overrideProp(target.fiber, prop, to === null ? undefined : to)
    }
  }

  /** A text node we already edited, inside this node. Its edited text no longer matches React's, so look it up by identity. */
  private findEdited(node: LayerNode): Text | null {
    for (const text of this.texts.keys()) if (hostsOf(node).some((h) => h.contains(text))) return text
    return null
  }

  /** The original text of a node we've edited, if any. */
  originalText(text: Text): string {
    return this.texts.get(text) ?? text.data
  }

  private keyFor(element: Element): string {
    let key = this.keys.get(element)
    if (!key) {
      key = String(this.nextKey++)
      this.keys.set(element, key)
    }
    if (element.getAttribute('data-dm') !== key) element.setAttribute('data-dm', key)
    return key
  }
}

function propRule(change: Change): PropRule | null {
  const prop = change.propName!
  const value = propValue(change.after)
  switch (change.scope.kind) {
    case 'line':
      return change.scope.src ? { src: change.scope.src, prop, value } : null
    case 'type':
      return { name: change.nodeName, when: { prop, value: propValue(change.before), fallback: change.propDefault }, prop, value }
    case 'default':
      return { name: change.nodeName, when: { prop, value: undefined, fallback: change.propDefault, onlyUnset: true }, prop, value }
    case 'instance':
      // Kept alive by the controller after each React commit instead.
      return null
  }
}
