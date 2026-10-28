import type { Controller, State } from '../controller'
import { propValue } from '../overrides'
import type { PropInfo } from '../../propTypes'
import type { LayerNode } from '../tree'
import { Icon } from './Icon'
import { ScopeChip } from './ScopeChip'

/** Props that are plumbing rather than design: never offered for editing. */
const HIDDEN = new Set(['className', 'style', 'children', 'key', 'ref', 'data-dm-src'])

/**
 * A component's properties, editable. The list and the options come from the
 * component's TypeScript types; the current values from what it was given on screen.
 */
export function Properties({ ctl, s, node }: { ctl: Controller; s: State; node: LayerNode }) {
  const info = ctl.componentInfo(node)
  const given = node.fiber?.memoizedProps ?? {}
  const typed = (info?.props ?? []).filter((p) => !HIDDEN.has(p.name))
  const typedNames = new Set(typed.map((p) => p.name))
  const others = Object.entries(given).filter(
    ([name, value]) => !HIDDEN.has(name) && !typedNames.has(name) && ['string', 'number', 'boolean'].includes(typeof value),
  )
  const changed = typed.filter((p) => ctl.changeFor(node, `prop:${p.name}`)).length
  const definition = info ? `${info.file}:${info.line}` : null

  return (
    <div class="sec">
      <div class="sec-h">
        <Icon name="sliders" size={13} /> Properties
        {changed > 0 && <span class="r cnt">{changed} changed</span>}
      </div>
      {info === undefined && <div class="note">Reading {node.name}'s props…</div>}
      {typed.map((prop) => (
        <PropRow key={prop.name} ctl={ctl} s={s} node={node} prop={prop} given={given[prop.name]} definition={definition} />
      ))}
      {info === null && <div class="note">No TypeScript props found for {node.name}, so these are read-only.</div>}
      {info && typed.length === 0 && others.length === 0 && <div class="note">{node.name} has no settable properties.</div>}
      {others.length > 0 && (
        <>
          {typed.length > 0 && <div class="sub-h">Also given (read-only)</div>}
          {others.map(([name, value]) => (
            <div class="row" key={name}>
              <span class="l">{name}</span>
              <span class="v" title={String(value)}>
                {String(value)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function PropRow({ ctl, node, prop, given, definition }: { ctl: Controller; s: State; node: LayerNode; prop: PropInfo; given: unknown; definition: string | null }) {
  const change = ctl.changeFor(node, `prop:${prop.name}`)
  const value = change ? propValue(change.after) : (given ?? prop.default ?? null)
  const set = (next: unknown) => ctl.setProp(node, prop, definition, next)

  return (
    <>
      <div class="row">
        <span class={`l ${change ? 'ov' : ''}`} title={prop.doc}>
          {prop.name}
        </span>
        <div class="ctl">
          <PropControl prop={prop} value={value} onChange={set} />
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

function PropControl({ prop, value, onChange }: { prop: PropInfo; value: unknown; onChange: (v: unknown) => void }) {
  if (prop.kind === 'boolean') {
    const on = value === true
    return (
      <button class="toggle" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
        <span class={`tg ${on ? 'on' : ''}`} />
      </button>
    )
  }
  if (prop.kind === 'enum') {
    const options = prop.options ?? []
    // Short lists of short words fit side by side; anything longer gets cut off there, so it's a dropdown.
    const longest = Math.max(...options.map((o) => o.length))
    if ((options.length <= 3 && longest <= 8) || (options.length === 4 && longest <= 5)) {
      return (
        <div class="seg wide">
          {options.map((option) => (
            <button key={option} class={value === option ? 'on' : ''} onClick={() => onChange(option)}>
              {option}
            </button>
          ))}
        </div>
      )
    }
    return (
      <select class="input select" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.currentTarget.value)}>
        {value === null && <option value="">not set</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }
  if (prop.kind === 'number') {
    return (
      <input
        class="input mono"
        type="number"
        // Data like 0.33999206666851774 is shown rounded; typing sets exactly what you type.
        value={typeof value === 'number' ? Math.round(value * 10000) / 10000 : ''}
        placeholder="not set"
        onInput={(e) => {
          const n = parseFloat(e.currentTarget.value)
          if (!Number.isNaN(n)) onChange(n)
        }}
      />
    )
  }
  return <input class="input" value={typeof value === 'string' ? value : ''} placeholder="not set" onInput={(e) => onChange(e.currentTarget.value)} />
}
