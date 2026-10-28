import { useMemo, useState } from 'preact/hooks'
import type { Controller, State } from '../controller'
import { styleTarget } from '../overrides'
import { normalizeInput, optionsFor, readValue, type Option } from '../properties'
import { Icon } from './Icon'

const WIDTH = 260
const MAX_HEIGHT = 360

/**
 * The value picker: the app's tokens first, grouped the way its theme file groups
 * them, then the scale, then a field for any raw value at the bottom.
 */
export function Picker({ ctl, s }: { ctl: Controller; s: State }) {
  const picker = s.picker
  const node = s.selected
  const element = node ? styleTarget(node) : null
  const [query, setQuery] = useState('')
  const [raw, setRaw] = useState('')

  const options = useMemo(() => (picker ? optionsFor(picker.prop, s.tokens) : []), [picker?.prop, s.tokens])
  if (!picker || !node || !element) return null

  const { prop, anchor } = picker
  const change = ctl.changeFor(node, prop.key)
  const before = change?.before ?? readValue(element, prop, s.tokens)
  const current = change?.after ?? before

  const shown = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options
  const groups: [string, Option[]][] = []
  for (const option of shown) {
    const last = groups[groups.length - 1]
    if (last && last[0] === option.group) last[1].push(option)
    else groups.push([option.group, [option]])
  }

  const pick = (css: string, display: string) => {
    ctl.setStyle(node, prop, before, css, display)
    ctl.set({ picker: null })
  }

  const below = anchor.y + anchor.height + 4
  const top = below + MAX_HEIGHT > window.innerHeight ? Math.max(8, anchor.y - MAX_HEIGHT - 4) : below
  const left = Math.min(Math.max(anchor.x + anchor.width - WIDTH, 8), window.innerWidth - WIDTH - 8)

  return (
    <>
      <div class="backdrop" onPointerDown={() => ctl.set({ picker: null })} />
      <div class="pop" style={{ top: `${top}px`, left: `${left}px`, width: `${WIDTH}px`, maxHeight: `${MAX_HEIGHT}px` }} role="listbox" aria-label={prop.label}>
        {options.length > 8 && (
          <label class="search">
            <Icon name="search" size={13} />
            <input autoFocus placeholder={`Search ${prop.label.toLowerCase()}`} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
          </label>
        )}
        <div class="pop-list">
          {groups.map(([group, items]) => (
            <div key={group}>
              <div class="gh">{group}</div>
              {items.map((o) => (
                <button key={o.css} class={`op ${o.css === current.css ? 'cur' : ''}`} onClick={() => pick(o.css, displayFor(o))}>
                  {o.swatch && <span class="sw" style={{ background: o.swatch }} />}
                  <span class={`ol ${o.level}`}>{o.label}</span>
                  <span class="v">
                    {o.css === before.css && change ? 'was · ' : ''}
                    {o.preview}
                  </span>
                  {o.css === current.css && <Icon name="check" size={13} class="tick" />}
                </button>
              ))}
            </div>
          ))}
          {options.length === 0 && <div class="gh">No tokens for {prop.label.toLowerCase()}. Type a value below.</div>}
          {options.length > 0 && shown.length === 0 && <div class="gh">Nothing matches.</div>}
        </div>
        <form
          class="rawin"
          onSubmit={(e) => {
            e.preventDefault()
            if (raw.trim()) pick(normalizeInput(prop, raw), raw.trim())
          }}
        >
          <span class="raw-l">Raw</span>
          <input class="input" placeholder={current.display} value={raw} onInput={(e) => setRaw(e.currentTarget.value)} autoFocus={options.length <= 8} />
          <span class="hint-key">↵</span>
        </form>
      </div>
    </>
  )
}

/** What the field shows after picking: the px value for a spacing step, the name otherwise. */
function displayFor(option: Option): string {
  return /^[\d.]+$/.test(option.label) ? option.preview.replace(/px$/, '') : option.label
}
