import { useMemo } from 'preact/hooks'
import type { Controller, State } from '../controller'
import { styleTarget, type Change } from '../overrides'
import { GROUPS, PROPS, readValue, summaryValue, type PropDef, type Value } from '../properties'
import type { LayerNode } from '../tree'
import { Icon } from './Icon'
import { ScopeChip } from './ScopeChip'

/**
 * The four style groups. Collapsed by default, each with a one-line summary; a group
 * holding a change opens by itself. "Show all styles" opens all four. Nothing else
 * on the panel goes away when it does.
 */
export function Styles({ ctl, s, node }: { ctl: Controller; s: State; node: LayerNode }) {
  const element = styleTarget(node)

  // Reading where every value comes from walks the page's stylesheets, so it's done
  // once per selection (and again when the page or the theme changes), not on every hover.
  const read = useMemo(() => {
    if (!element) return null
    const style = getComputedStyle(element)
    const defs = PROPS.filter((d) => !d.when || d.when(style))
    return defs.map((def) => ({ def, value: readValue(element, def, s.tokens) }))
  }, [element, s.tree, s.tokens])

  if (!element || !read) return null

  return (
    <div class="sec styles">
      <div class="sec-h">
        <Icon name="palette" size={13} /> Styles
        <span class="r">
          <button class="switch-label" onClick={() => ctl.set({ showAllStyles: !s.showAllStyles })} aria-pressed={s.showAllStyles}>
            Show all styles <span class={`tg ${s.showAllStyles ? 'on' : ''}`} />
          </button>
        </span>
      </div>
      {GROUPS.map((group) => {
        const rows = read
          .filter((r) => r.def.group === group.key)
          .map((r) => {
            const change = ctl.changeFor(node, r.def.key)
            return { ...r, change, shown: change?.after ?? r.value }
          })
        if (rows.length === 0) return null
        const changed = rows.filter((r) => r.change).length
        const open = s.showAllStyles || (s.openGroups.get(group.key) ?? changed > 0)
        const summary = rows
          .map((r) => summaryValue(r.shown))
          .filter(Boolean)
          .slice(0, 2)
          .join(' · ')

        return (
          <div class="grp" key={group.key}>
            <button
              class="grp-h"
              aria-expanded={open}
              onClick={() => ctl.set({ openGroups: new Map(s.openGroups).set(group.key, !open) })}
            >
              <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
              {group.label}
              {changed > 0 ? <span class="cnt">{changed} changed</span> : !open && <span class="sum">{summary || 'none'}</span>}
            </button>
            {open && (
              <div class="grp-body">
                {rows.map(({ def, change, shown }) => (
                  <StyleRow key={def.key} ctl={ctl} s={s} def={def} value={shown} change={change ?? null} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StyleRow({ ctl, s, def, value, change }: { ctl: Controller; s: State; def: PropDef; value: Value; change: Change | null }) {
  const picking = s.picker?.prop.key === def.key
  return (
    <>
      <div class="row">
        <span class={`l ${change ? 'ov' : ''}`}>{def.label}</span>
        <div class="ctl">
          <ValueField value={value} active={picking} onClick={(e) => ctl.openPicker(def, e.currentTarget as Element)} />
          {change && (
            <button class="ib sm" title="Reset" onClick={() => ctl.undoChange(change.id)}>
              <Icon name="undo" size={14} />
            </button>
          )}
        </div>
      </div>
      {change && <ScopeChip ctl={ctl} change={change} />}
    </>
  )
}

/** A value in a field, marked by level: a diamond for a token, amber "raw" for a one-off, faint when nothing is set. */
export function ValueField({ value, active, onClick }: { value: Value; active?: boolean; onClick?: (e: MouseEvent) => void }) {
  return (
    <button class={`field ${active ? 'focus' : ''}`} onClick={onClick} title={value.source ? `${value.source.selector ?? 'inline style'} → ${value.source.value}` : undefined}>
      {value.swatch && value.display !== 'none' && <span class="sw" style={{ background: value.swatch }} />}
      <span class={`val ${value.level}`}>{value.display || '—'}</span>
      {value.inherited && <span class="inh">inherited</span>}
      {value.level === 'raw' && <span class="rawflag">raw</span>}
    </button>
  )
}
