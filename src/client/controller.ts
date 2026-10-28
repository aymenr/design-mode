import { invalidateRules } from './cascade'
import type { ComponentInfo, PropInfo } from '../propTypes'
import { onReactCommit } from './liveProps'
import { Overrides, propValue, styleTarget, textNodeOf, type Change, type Scope } from './overrides'
import { valueFromCss, type GroupKey, type PropDef, type Value } from './properties'
import { forceState, type ForcedState } from './force'
import { buildPrompt } from './prompt'
import { componentsNamed, definitionHint, shortSrc, SRC_ATTR, srcOf } from './source'
import { loadTokens, type Tokens } from './tokens'
import {
  ancestorsOf,
  buildTree,
  nearestComponent,
  nodeForElement,
  rectOf,
  runsOf,
  visibleChildren,
  visibleParent,
  type Filter,
  type LayerNode,
  type LayerTree,
} from './tree'

export interface State {
  /** Off hides the tool entirely. ⌥⇧D flips it. */
  enabled: boolean
  /** Select mode: hovering outlines things, clicking selects, and the app gets no input. */
  selecting: boolean
  panelOpen: boolean
  menuOpen: boolean
  /** Freeze: the app gets no input at all and its animations pause, so open menus stay open. */
  frozen: boolean
  tab: 'inspect' | 'changes'
  filter: Filter
  layersOpen: boolean
  hover: LayerNode | null
  selected: LayerNode | null
  tree: LayerTree
  /** Rows the user opened or closed by hand. Rows not in here use the default. */
  expanded: Map<string, boolean>
  /** Where the panel was dragged to; null is its default spot in a top corner. */
  panelPos: { x: number; y: number } | null
  /** Which top corner the undragged panel sits in. It moves aside so it never covers what you just selected. */
  panelSide: 'left' | 'right'

  tokens: Tokens
  changes: Change[]
  /** "Hide my changes": every edit stays in the list but comes off the page. */
  hidden: boolean
  showAllStyles: boolean
  /** Style groups opened or closed by hand. Groups not in here are open only when they hold a change. */
  openGroups: Map<GroupKey, boolean>
  /** The value picker, open under the field it belongs to. */
  picker: { prop: PropDef; anchor: { x: number; y: number; width: number; height: number } } | null
  toast: { text: string; action?: { label: string; run: () => void } } | null
  /** Nodes outlined while you hover a scope option, to show what it would cover. */
  scopePreview: LayerNode[] | null
  promptOpen: boolean
  /** The selected element shown as hovered or pressed. Cleared when the selection changes. */
  forced: ForcedState
}

/** The panel's size and its gap from the window edge, for keeping it off what's selected. */
export const PANEL_WIDTH = 300
export const PANEL_EDGE = 12

const POINTER_EVENTS = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'touchstart',
  'touchend',
] as const
const KEY_EVENTS = ['keydown', 'keyup', 'keypress'] as const
const FOCUS_EVENTS = ['focusin', 'focusout', 'focus', 'blur'] as const

/** How long the tree waits after the page changes before rebuilding. */
const REBUILD_DELAY_MS = 300

/**
 * All of Design Mode's state, and everything that talks to the page: listening for
 * input, keeping it from the app when it should, and keeping the layers tree fresh.
 * The UI only reads `state` and calls these methods.
 */
export class Controller {
  state: State
  private listeners = new Set<() => void>()
  private treeDirty = true
  private rebuildTimer: number | null = null
  private hoverFrame: number | null = null
  private pausedAnimations: Animation[] = []
  private overrides = new Overrides()
  private nextChangeId = 1
  private toastTimer: number | null = null
  private componentInfos = new Map<string, ComponentInfo | null>()
  private componentRequests = new Set<string>()
  private commitFrame: number | null = null
  /** The changes as they were when last copied, to tell whether a reload would lose anything. */
  private copied = ''

  constructor(private host: Element) {
    this.state = {
      enabled: true,
      selecting: false,
      panelOpen: false,
      menuOpen: false,
      frozen: false,
      tab: 'inspect',
      filter: 'components',
      layersOpen: true,
      hover: null,
      selected: null,
      tree: { roots: [], byId: new Map(), byElement: new Map(), react: false },
      expanded: new Map(),
      panelPos: null,
      panelSide: 'right',
      tokens: { app: [], appNames: new Set(), scaleNames: [] },
      changes: [],
      hidden: false,
      showAllStyles: false,
      openGroups: new Map(),
      picker: null,
      toast: null,
      scopePreview: null,
      promptOpen: true,
      forced: 'none',
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  install() {
    for (const type of KEY_EVENTS) window.addEventListener(type, this.onKey, true)
    for (const type of POINTER_EVENTS) window.addEventListener(type, this.onPointer, { capture: true, passive: false })
    for (const type of FOCUS_EVENTS) window.addEventListener(type, this.onFocus, true)
    window.addEventListener('pointermove', this.onPointerMove, { capture: true, passive: true })

    // The tool's own clicks and key presses must not reach the app's listeners on
    // document and window. Otherwise clicking the panel counts as "clicking outside"
    // and closes the app's open menu, and typing in the panel plays piano notes.
    for (const type of [...POINTER_EVENTS, ...KEY_EVENTS, 'focusin', 'focusout']) {
      this.host.addEventListener(type, (event) => event.stopPropagation())
    }

    new MutationObserver((records) => {
      // Stamping our own attributes on elements is our doing, not the page changing.
      if (records.every((r) => r.attributeName?.startsWith('data-dm') && r.attributeName !== 'data-dm-src')) return
      this.treeDirty = true
      this.scheduleRebuild()
    }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })

    // Tweaks don't survive a reload, so ask first when there are any. This also
    // catches Vite reloading the page by itself after a file is saved.
    // A prop changed for "only this one" lasts until the component's parent renders
    // again. After every React commit that touched anything, put it back.
    onReactCommit(() => {
      if (this.commitFrame !== null) return
      if (!this.state.changes.some((c) => c.kind === 'prop' && c.enabled && c.scope.kind === 'instance')) return
      this.commitFrame = requestAnimationFrame(() => {
        this.commitFrame = null
        this.treeDirty = true
        this.refreshTree()
      })
    })

    window.addEventListener('beforeunload', (event) => {
      // Copied changes are safe: they're in the prompt. This matters because a coding agent
      // applying the prompt makes Vite reload the page, which shouldn't need confirming.
      if (!this.state.enabled || this.state.changes.length === 0 || this.signature() === this.copied) return
      event.preventDefault()
      // Older browsers only show the warning when this is set.
      event.returnValue = ''
    })

  }

  // ── Tree ───────────────────────────────────────────────

  /** Rebuilds the tree now if the page changed since the last build. */
  refreshTree(apply = true) {
    if (!this.treeDirty) return
    this.treeDirty = false
    invalidateRules()
    const tree = buildTree(this.host)
    const { selected, hover } = this.state
    this.set({
      tree,
      filter: tree.react ? this.state.filter : 'all',
      selected: selected ? this.relocate(selected, tree) : null,
      hover: hover ? this.relocate(hover, tree) : null,
    })
    if (apply) this.applyChanges()
  }

  private scheduleRebuild() {
    if (this.rebuildTimer !== null) return
    if (!this.state.panelOpen && !this.state.selecting) return
    this.rebuildTimer = window.setTimeout(() => {
      this.rebuildTimer = null
      this.refreshTree()
    }, REBUILD_DELAY_MS)
  }

  /** Finds the same node in a freshly built tree: by its path, or failing that by the element it draws. */
  private relocate(node: LayerNode, tree: LayerTree): LayerNode | null {
    const byId = tree.byId.get(node.id)
    if (byId) return byId
    const element = node.element ?? node.children[0]?.element ?? null
    if (!element || !element.isConnected) return null
    const tag = nodeForElement(tree, element)
    if (!tag || node.kind === 'tag') return tag
    for (let n: LayerNode | null = tag; n; n = n.parent) if (n.kind === 'component' && n.name === node.name) return n
    return null
  }

  // ── Selecting ──────────────────────────────────────────

  toggleSelecting() {
    if (this.state.selecting) this.stopSelecting()
    else this.startSelecting()
  }

  startSelecting() {
    this.reloadTokens()
    this.treeDirty = true
    this.refreshTree()
    this.set({ selecting: true, menuOpen: false })
  }

  stopSelecting() {
    this.set({ selecting: false, hover: null })
  }

  /** What's under the pointer: the nearest component, or with ⌥ the exact tag. */
  private pickAt(x: number, y: number, exactTag: boolean): LayerNode | null {
    const element = document.elementFromPoint(x, y)
    if (!element || element === this.host) return null
    this.refreshTree()
    const tag = nodeForElement(this.state.tree, element)
    if (!tag) return null
    return exactTag ? tag : (nearestComponent(tag) ?? tag)
  }

  select(node: LayerNode | null) {
    if (this.state.forced !== 'none' && node !== this.state.selected) this.setForced('none')
    if (!node) {
      this.set({ selected: null, picker: null })
      return
    }
    // A plain tag can't be shown while the tree lists components only.
    const filter: Filter = node.kind === 'tag' ? 'all' : this.state.filter
    this.set({
      selected: node,
      picker: null,
      selecting: false,
      hover: null,
      panelOpen: true,
      tab: 'inspect',
      filter,
      expanded: this.expandedTo(node, filter),
      panelSide: this.sideFor(node),
    })
  }

  setForced(forced: ForcedState) {
    const node = this.state.selected
    forceState(node ? styleTarget(node) : null, forced)
    this.set({ forced })
  }

  /** The corner for the panel that doesn't cover a node. A panel you've dragged stays where you put it. */
  private sideFor(node: LayerNode): 'left' | 'right' {
    const side = this.state.panelSide
    const rect = rectOf(node)
    if (this.state.panelPos || !rect) return side
    const reach = PANEL_WIDTH + 2 * PANEL_EDGE
    const coversRight = rect.right > window.innerWidth - reach
    const coversLeft = rect.left < reach
    if (side === 'right' && coversRight && !coversLeft) return 'left'
    if (side === 'left' && coversLeft && !coversRight) return 'right'
    return side
  }

  /** Opens every row above a node, including any "Card ×3" group it sits in, so the tree shows it. */
  private expandedTo(node: LayerNode, filter: Filter): Map<string, boolean> {
    const expanded = new Map(this.state.expanded)
    const chain = [...ancestorsOf(node, filter), node]
    for (let i = 0; i < chain.length; i++) {
      const parent = i === 0 ? null : chain[i - 1]
      if (parent) expanded.set(parent.id, true)
      const run = runsOf(visibleChildren(parent, this.state.tree, filter)).find((r) => r.nodes.includes(chain[i]))
      if (run && run.nodes.length > 1) expanded.set(run.key, true)
    }
    return expanded
  }

  setFilter(filter: Filter) {
    const { selected } = this.state
    this.set({ filter, selected: filter === 'components' && selected?.kind === 'tag' ? nearestComponent(selected) : selected })
    if (this.state.selected) this.set({ expanded: this.expandedTo(this.state.selected, filter) })
  }

  toggleRow(key: string, open: boolean) {
    const expanded = new Map(this.state.expanded)
    expanded.set(key, !open)
    this.set({ expanded })
  }

  // ── Edits ──────────────────────────────────────────────

  /**
   * Records an edit to one property of a node and shows it on the page. Editing the
   * same property again updates the same change (keeping its original "before" and
   * its scope); editing it back to where it started removes the change.
   */
  private record(node: LayerNode, draft: Omit<Change, 'id' | 'nodeId' | 'nodeName' | 'nodeKind' | 'path' | 'before' | 'after' | 'scope' | 'enabled'>, before: Value, after: Value) {
    const changes = [...this.state.changes]
    const index = changes.findIndex((c) => c.nodeId === node.id && c.propKey === draft.propKey)
    const old = index >= 0 ? changes[index] : null
    const original = old ? old.before : before
    if (after.css === original.css) {
      changes.splice(index, 1)
    } else if (old) {
      changes[index] = { ...old, after, enabled: true }
    } else {
      const change: Change = {
        ...draft,
        id: this.nextChangeId++,
        nodeId: node.id,
        nodeName: node.name,
        nodeKind: node.kind,
        path: [...ancestorsOf(node, 'components').slice(-2), node].map((n) => n.name).join(' › '),
        before,
        after,
        scope: { kind: 'instance', label: 'Only this one', detail: '' },
        enabled: true,
      }
      change.scope = this.scopeOptions(change)[0]
      changes.push(change)
    }
    this.commit(changes, old ? [old] : [])
  }

  setStyle(node: LayerNode, prop: PropDef, before: Value, css: string, display: string) {
    const after = valueFromCss(prop, css, display, this.state.tokens)
    this.record(node, { kind: 'style', src: srcOf(node), propKey: prop.key, label: prop.label, cssProperty: prop.write, propName: null }, before, after)
  }

  setText(node: LayerNode, text: string) {
    const textNode = textNodeOf(node)
    if (!textNode) return
    const existing = this.changeFor(node, 'text')
    const original = existing?.before.css ?? this.overrides.originalText(textNode)
    const value = (t: string): Value => ({ css: t, display: t, level: 'none', token: null, swatch: null, inherited: false, source: null })
    this.record(node, { kind: 'text', src: srcOf(node), propKey: 'text', label: 'Text', cssProperty: null, propName: null }, value(original), value(text))
  }

  /** Changes one of a component's props, e.g. Button's `variant`. */
  setProp(stale: LayerNode, info: PropInfo, definition: string | null, value: unknown) {
    const node = this.fresh(stale)
    const existing = this.changeFor(node, `prop:${info.name}`)
    const given = node.fiber?.memoizedProps?.[info.name]
    const before = existing ? propValue(existing.before) : (given ?? info.default ?? null)
    const asValue = (v: unknown): Value => ({
      css: JSON.stringify(v ?? null),
      display: v === null || v === undefined ? 'not set' : String(v),
      level: 'none',
      token: null,
      swatch: null,
      inherited: false,
      source: null,
    })
    this.record(
      node,
      { kind: 'prop', src: srcOf(node), propKey: `prop:${info.name}`, label: info.name, cssProperty: null, propName: info.name, propDefault: info.default ?? null, definition },
      asValue(before),
      asValue(value),
    )
  }

  /**
   * The same node in a tree read just now. A node's fiber goes stale as soon as React
   * renders again, and its props with it, so anything that reads props to decide
   * something (rather than just to show it) asks for a fresh one.
   */
  private fresh(node: LayerNode): LayerNode {
    this.treeDirty = true
    this.refreshTree(false)
    return this.state.tree.byId.get(node.id) ?? node
  }

  changeFor(node: LayerNode, propKey: string): Change | undefined {
    return this.state.changes.find((c) => c.nodeId === node.id && c.propKey === propKey)
  }

  /**
   * Who an edit could apply to, narrowest first, each saying what it means for the
   * code. The first one is the default for a new edit.
   */
  scopeOptions(change: Change): Scope[] {
    const tree = this.state.tree
    const node = tree.byId.get(change.nodeId)
    const where = shortSrc(change.src)
    const options: Scope[] = []

    if (change.kind === 'text') return [{ kind: 'instance', label: 'Only this one', detail: where ? `edits ${where}` : '' }]

    if (change.kind === 'style') {
      options.push({ kind: 'instance', label: 'Only this one', detail: where ? `edits ${where}` : '' })
      const src = node ? (styleTarget(node)?.getAttribute(SRC_ATTR) ?? null) : null
      if (node && src) {
        const count = document.querySelectorAll(`[${SRC_ATTR}="${CSS.escape(src)}"]`).length
        if (node.kind === 'component') {
          options.push({ kind: 'line', src, label: `Every ${node.name}`, detail: `${count} on screen · edits ${shortSrc(src)}` })
        } else if (count > 1) {
          options.push({ kind: 'line', src, label: `All ${count} from this line`, detail: `edits ${shortSrc(src)}` })
        }
      }
      return options
    }

    // A prop.
    const name = change.nodeName
    const prop = change.propName!
    const sameLine = change.src ? [...tree.byId.values()].filter((n) => n.kind === 'component' && srcOf(n) === change.src) : []
    if (sameLine.length <= 1) {
      options.push({ kind: 'line', src: change.src ?? undefined, label: 'Only this one', detail: `edits ${where}` })
    } else {
      options.push({ kind: 'instance', label: 'Only this one', detail: `1 of ${sameLine.length} drawn by ${where}, so the code needs a condition` })
      options.push({ kind: 'line', src: change.src ?? undefined, label: `All ${sameLine.length} from this line`, detail: `edits ${where}` })
    }
    const before = propValue(change.before)
    const matching = this.scopeTargets(change, { kind: 'type', label: '', detail: '' }).length
    options.push({ kind: 'type', label: `Every ${name} with ${prop} = ${formatProp(before)}`, detail: `${matching} on screen · edits each place it's used` })
    if (before === (change.propDefault ?? null)) {
      options.push({
        kind: 'default',
        label: `Change ${name}'s default`,
        detail: `edits ${shortSrc(change.definition ?? null) || `${name}'s file`} · every ${name} that doesn't set ${prop}`,
      })
    }
    return options
  }

  /** The nodes on screen a scope would cover, for outlining them while you choose. */
  scopeTargets(change: Change, scope: Scope): LayerNode[] {
    const tree = this.state.tree
    const node = tree.byId.get(change.nodeId)
    if (scope.kind === 'instance') return node ? [node] : []
    if (scope.kind === 'line') {
      if (change.kind === 'style') {
        return Array.from(document.querySelectorAll(`[${SRC_ATTR}="${CSS.escape(scope.src ?? '')}"]`))
          .map((el) => tree.byElement.get(el))
          .filter((n): n is LayerNode => !!n)
      }
      return [...tree.byId.values()].filter((n) => n.kind === 'component' && srcOf(n) === scope.src)
    }
    const prop = change.propName ?? ''
    const fallback = change.propDefault ?? null
    const values = [propValue(change.before), propValue(change.after)]
    return componentsNamed(tree, change.nodeName).filter((n) => {
      const given = n.fiber?.memoizedProps?.[prop]
      if (scope.kind === 'default') return given === undefined || given === fallback
      return values.includes(given === undefined ? fallback : given)
    })
  }

  setScope(id: number, scope: Scope) {
    const old = this.state.changes.find((c) => c.id === id)
    if (!old) return
    this.commit(
      this.state.changes.map((c) => (c.id === id ? { ...c, scope } : c)),
      [old],
    )
    this.set({ scopePreview: null })
  }

  undoChange(id: number) {
    this.commit(
      this.state.changes.filter((c) => c.id !== id),
      this.state.changes.filter((c) => c.id === id),
    )
  }

  toggleChange(id: number) {
    const old = this.state.changes.find((c) => c.id === id)
    this.commit(
      this.state.changes.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c)),
      old?.enabled ? [old] : [],
    )
  }

  toggleHidden() {
    const hiding = !this.state.hidden
    this.set({ hidden: hiding, menuOpen: false })
    this.commit(this.state.changes, hiding ? this.state.changes : [])
  }

  /** Clears every edit, with an Undo for a few seconds in case it was a slip. */
  discardAll() {
    const discarded = this.state.changes
    if (discarded.length === 0) return
    this.commit([], discarded)
    this.showToast(`${discarded.length} ${discarded.length === 1 ? 'change' : 'changes'} discarded`, {
      label: 'Undo',
      run: () => {
        this.set({ toast: null })
        this.commit([...discarded, ...this.state.changes], [])
      },
    })
  }

  showToast(text: string, action?: { label: string; run: () => void }) {
    if (this.toastTimer !== null) clearTimeout(this.toastTimer)
    this.set({ toast: { text, action } })
    this.toastTimer = window.setTimeout(() => this.set({ toast: null }), 8000)
  }

  /** The prompt for the current changes, for whichever coding agent you use. */
  prompt(): string {
    return buildPrompt(this.state.changes, this.state.tree)
  }

  async copyPrompt() {
    this.refreshTree()
    const text = this.prompt()
    if (!text) {
      this.showToast('Nothing to copy: every change is switched off.')
      return
    }
    const ok = await copyText(text)
    this.set({ menuOpen: false })
    if (ok) {
      this.copied = this.signature()
      this.showToast('Prompt copied. Paste it into your coding agent.')
    } else {
      this.showToast("Couldn't copy. Select the preview text and copy it instead.")
    }
  }

  /** What a change list amounts to, for comparing against what was copied. */
  private signature(): string {
    return JSON.stringify(this.state.changes.filter((c) => c.enabled).map((c) => [c.nodeId, c.propKey, c.after.css, c.scope.kind]))
  }

  /** Selects the node a change belongs to and shows it in the Inspect tab. */
  showChange(change: Change) {
    this.refreshTree()
    const node = this.state.tree.byId.get(change.nodeId)
    if (node) this.select(node)
  }

  /** The props a component accepts, from its TypeScript types (asked of the plugin once per component). */
  componentInfo(node: LayerNode): ComponentInfo | null | undefined {
    const known = this.componentInfos.get(node.name)
    if (known !== undefined || this.componentRequests.has(node.name)) return known
    this.componentRequests.add(node.name)
    const hint = definitionHint(node)
    void fetch(`/@design-mode/component.json?name=${encodeURIComponent(node.name)}${hint ? `&hint=${encodeURIComponent(hint)}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((info: ComponentInfo | null) => {
        this.componentInfos.set(node.name, info)
        this.set({})
      })
    return undefined
  }

  /**
   * Tokens are read again whenever the tool comes into use: the app's CSS loads after
   * this script, and the theme file can change while you work.
   */
  private reloadTokens() {
    void loadTokens().then((tokens) => this.set({ tokens }))
  }

  /** Saves the new list of changes, takes the replaced or removed ones off the page, and puts the rest on. */
  private commit(changes: Change[], removed: Change[]) {
    // Prop edits act on React's fibers, which go stale with every render: read them fresh.
    if ([...changes, ...removed].some((c) => c.kind === 'prop')) {
      this.treeDirty = true
      this.refreshTree(false)
    }
    this.set({ changes })
    if (removed.length) this.overrides.revertProps(removed, this.state.tree)
    this.applyChanges()
  }

  private applyChanges() {
    this.overrides.apply(this.state.changes, this.state.tree, this.state.hidden)
  }

  openPicker(prop: PropDef, anchor: Element) {
    const r = anchor.getBoundingClientRect()
    this.set({ picker: { prop, anchor: { x: r.left, y: r.top, width: r.width, height: r.height } } })
  }

  // ── Panel, menu, freeze, on/off ────────────────────────

  openPanel() {
    this.reloadTokens()
    this.treeDirty = true
    this.set({ panelOpen: true, menuOpen: false })
    this.refreshTree()
  }

  closePanel() {
    if (this.state.forced !== 'none') this.setForced('none')
    this.set({ panelOpen: false, selecting: false, hover: null })
  }

  toggleFreeze() {
    if (this.state.frozen) {
      for (const animation of this.pausedAnimations) animation.play()
      this.pausedAnimations = []
    } else {
      this.pausedAnimations = document.getAnimations().filter((a) => a.playState === 'running')
      for (const animation of this.pausedAnimations) animation.pause()
    }
    this.set({ frozen: !this.state.frozen })
  }

  toggleEnabled() {
    if (this.state.enabled) {
      if (this.state.frozen) this.toggleFreeze()
      this.set({ enabled: false, selecting: false, menuOpen: false, hover: null })
    } else {
      this.set({ enabled: true })
    }
  }

  /** Esc closes the innermost thing first: picker or menu, then select mode, then the selection, then the panel. */
  escape() {
    const { picker, menuOpen, selecting, selected, panelOpen } = this.state
    if (picker) this.set({ picker: null })
    else if (menuOpen) this.set({ menuOpen: false })
    else if (selecting) this.stopSelecting()
    else if (selected) this.select(null)
    else if (panelOpen) this.closePanel()
  }

  // ── Input from the page ────────────────────────────────

  private fromTool(event: Event): boolean {
    return event.composedPath().includes(this.host)
  }

  /** Stops an event before the app's own listeners see it. */
  private swallow(event: Event) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  private onKey = (event: Event) => {
    const e = event as KeyboardEvent
    // `code`, not `key`: on a Mac ⌥⇧D types "Î", so the key name isn't "D".
    if (e.altKey && e.shiftKey && e.code === 'KeyD') {
      this.swallow(e)
      if (e.type === 'keydown' && !e.repeat) this.toggleEnabled()
      return
    }
    if (!this.state.enabled) return

    if (this.fromTool(e)) {
      if (e.type === 'keydown' && e.key === 'Escape') this.escape()
      return
    }
    if (this.state.selecting) {
      this.swallow(e)
      if (e.type !== 'keydown') return
      if (e.key === 'Escape') this.escape()
      else if (e.key === 'ArrowUp' && this.state.hover) {
        this.set({ hover: visibleParent(this.state.hover, this.state.filter) ?? this.state.hover })
      }
      return
    }
    if (this.state.frozen) this.swallow(e)
  }

  private onPointer = (event: Event) => {
    if (!this.state.enabled || this.fromTool(event)) return
    if (this.state.menuOpen && event.type === 'pointerdown') this.set({ menuOpen: false })
    if (!this.state.selecting && !this.state.frozen) return

    this.swallow(event)
    if (this.state.selecting && event.type === 'click') {
      const e = event as MouseEvent
      const node = this.pickAt(e.clientX, e.clientY, e.altKey)
      if (node) this.select(node)
    }
  }

  private onFocus = (event: Event) => {
    // While frozen, the app doesn't learn that focus left it (clicking the panel
    // would otherwise blur the app's open menu and close it).
    if (this.state.enabled && this.state.frozen && !this.fromTool(event)) event.stopImmediatePropagation()
  }

  private onPointerMove = (event: Event) => {
    if (!this.state.enabled || !this.state.selecting) return
    if (this.fromTool(event)) {
      if (this.state.hover) this.set({ hover: null })
      return
    }
    const e = event as PointerEvent
    if (this.hoverFrame !== null) cancelAnimationFrame(this.hoverFrame)
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = null
      const hover = this.pickAt(e.clientX, e.clientY, e.altKey)
      if (hover !== this.state.hover) this.set({ hover })
    })
  }
}

/** A prop value the way you'd write it: `"primary"` as primary, `true` as true, nothing as "not set". */
function formatProp(value: unknown): string {
  return value === null || value === undefined ? 'not set' : String(value)
}

/** Puts text on the clipboard, falling back to the old copy command where the clipboard API is blocked. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text })
    area.style.cssText = 'position: fixed; opacity: 0; pointer-events: none;'
    document.documentElement.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}
