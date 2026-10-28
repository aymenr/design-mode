import { useEffect, useRef } from 'preact/hooks'
import type { Controller, State } from '../controller'
import { ancestorsOf, labelOf, runsOf, visibleChildren, type LayerNode, type Run } from '../tree'
import { Icon } from './Icon'

type Row =
  | { type: 'node'; node: LayerNode; depth: number; open: boolean; hasKids: boolean }
  | { type: 'run'; run: Run; depth: number; open: boolean }

/** A safety cap on rendered rows, in case someone opens every row of a huge page. */
const MAX_ROWS = 1500

/**
 * Indent per level, and the level where indenting stops. With tags shown, real pages
 * nest 20+ deep, and full indentation would squeeze deep names to nothing.
 */
const INDENT = 10
const MAX_INDENT_DEPTH = 12
const indent = (depth: number) => `${Math.min(depth, MAX_INDENT_DEPTH) * INDENT}px`

/**
 * The layers tree, like Figma's layers panel. Components only by default, with
 * "+ tags" to show plain HTML too. A run of same-named siblings is grouped into one
 * "Card ×3" row. Rows open by default when there's only one thing inside, so chains
 * of wrappers don't take a click each.
 */
export function Layers({ ctl, s }: { ctl: Controller; s: State }) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('.ly.sel')?.scrollIntoView({ block: 'nearest' })
  }, [s.selected?.id, s.layersOpen])

  if (!s.layersOpen) {
    const path = s.selected ? [...ancestorsOf(s.selected, s.filter), s.selected].map((n) => n.name) : []
    return (
      <div class="sec">
        <button class="sec-h strip" onClick={() => ctl.set({ layersOpen: true })}>
          <Icon name="chevron-right" size={13} /> Layers {path.length > 0 && <>· <b>{path.slice(-3).join(' › ')}</b></>}
        </button>
      </div>
    )
  }

  const rows = buildRows(s)

  return (
    <div class="sec">
      <div class="sec-h">
        <Icon name="layers" size={13} /> Layers
        <span class="r">
          {s.tree.react && (
            <span class="seg">
              <button class={s.filter === 'components' ? 'on' : ''} onClick={() => ctl.setFilter('components')}>
                Components
              </button>
              <button class={s.filter === 'all' ? 'on' : ''} onClick={() => ctl.setFilter('all')}>
                + tags
              </button>
            </span>
          )}
          <button class="ib sm" aria-label="Collapse layers" onClick={() => ctl.set({ layersOpen: false })}>
            <Icon name="chevron-up" size={14} />
          </button>
        </span>
      </div>
      <div class="layers" ref={listRef}>
        {rows.length === 0 && <div class="empty-tree">Nothing on the page yet.</div>}
        {rows.map((row) => (row.type === 'run' ? <RunRow key={row.run.key} ctl={ctl} row={row} /> : <NodeRow key={row.node.id} ctl={ctl} s={s} row={row} />))}
      </div>
    </div>
  )
}

function NodeRow({ ctl, s, row }: { ctl: Controller; s: State; row: Extract<Row, { type: 'node' }> }) {
  const { node, depth, open, hasKids } = row
  return (
    <div
      class={`ly ${node.kind} ${s.selected === node ? 'sel' : ''}`}
      style={{ paddingLeft: indent(depth) }}
      onClick={() => ctl.select(node)}
      onPointerEnter={() => ctl.set({ hover: node })}
      onPointerLeave={() => ctl.set({ hover: null })}
    >
      <button
        class="ch"
        aria-label={open ? 'Collapse' : 'Expand'}
        tabIndex={hasKids ? 0 : -1}
        onClick={(e) => {
          e.stopPropagation()
          if (hasKids) ctl.toggleRow(node.id, open)
        }}
      >
        {hasKids && <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />}
      </button>
      <Icon name={node.kind === 'component' ? 'component' : 'code'} size={13} class="k" />
      <span class="nm">{node.name}</span>
      {/* Only leaves get a label: for anything bigger the text is the whole subtree. */}
      {!hasKids && <span class="meta">{labelOf(node)}</span>}
    </div>
  )
}

function RunRow({ ctl, row }: { ctl: Controller; row: Extract<Row, { type: 'run' }> }) {
  const { run, depth, open } = row
  const first = run.nodes[0]
  return (
    <div class={`ly ${first.kind}`} style={{ paddingLeft: indent(depth) }} onClick={() => ctl.toggleRow(run.key, open)}>
      <span class="ch">
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
      </span>
      <Icon name={first.kind === 'component' ? 'component' : 'code'} size={13} class="k" />
      <span class="nm">{first.name}</span>
      <span class="rep">×{run.nodes.length}</span>
    </div>
  )
}

function buildRows(s: State): Row[] {
  const rows: Row[] = []
  const isOpen = (key: string, fallback: boolean) => s.expanded.get(key) ?? fallback

  const addNode = (node: LayerNode, depth: number) => {
    const kids = visibleChildren(node, s.tree, s.filter)
    const open = kids.length > 0 && isOpen(node.id, depth === 0 || kids.length === 1)
    rows.push({ type: 'node', node, depth, open, hasKids: kids.length > 0 })
    if (open) addChildren(kids, depth + 1)
  }

  const addChildren = (nodes: LayerNode[], depth: number) => {
    for (const run of runsOf(nodes)) {
      if (rows.length >= MAX_ROWS) return
      if (run.nodes.length === 1) {
        addNode(run.nodes[0], depth)
        continue
      }
      const open = isOpen(run.key, false)
      rows.push({ type: 'run', run, depth, open })
      if (open) for (const node of run.nodes) addNode(node, depth + 1)
    }
  }

  addChildren(visibleChildren(null, s.tree, s.filter), 0)
  return rows
}
