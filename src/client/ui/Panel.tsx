import { useState } from 'preact/hooks'
import { PANEL_EDGE, PANEL_WIDTH, type Controller, type State } from '../controller'
import { textNodeOf } from '../overrides'
import { ancestorsOf, hostsOf, rectOf } from '../tree'
import { Icon } from './Icon'
import { srcOf, shortSrc } from '../source'
import { Changes } from './Changes'
import { Layers } from './Layers'
import { Properties } from './Properties'
import { ScopeChip } from './ScopeChip'
import { Styles } from './Styles'

const EDGE = PANEL_EDGE

/** The floating panel: one header on every screen, with Inspect and Changes tabs. Drag it by the header. */
export function Panel({ ctl, s }: { ctl: Controller; s: State }) {
  const [dragging, setDragging] = useState(false)
  const pos = clampToViewport(s.panelPos ?? { x: s.panelSide === 'left' ? EDGE : window.innerWidth - PANEL_WIDTH - EDGE, y: EDGE })

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('button')) return
    const head = e.currentTarget as HTMLElement
    const start = { pointerX: e.clientX, pointerY: e.clientY, x: pos.x, y: pos.y }
    head.setPointerCapture(e.pointerId)
    setDragging(true)
    const move = (ev: PointerEvent) => {
      ctl.set({ panelPos: clampToViewport({ x: start.x + ev.clientX - start.pointerX, y: start.y + ev.clientY - start.pointerY }) })
    }
    const up = () => {
      head.removeEventListener('pointermove', move)
      head.removeEventListener('pointerup', up)
      setDragging(false)
    }
    head.addEventListener('pointermove', move)
    head.addEventListener('pointerup', up)
  }

  return (
    <div
      class="panel"
      style={{ left: `${pos.x}px`, top: `${pos.y}px`, maxHeight: `calc(100vh - ${pos.y + EDGE}px)` }}
      role="dialog"
      aria-label="Design mode"
    >
      <div class={`p-head ${dragging ? 'dragging' : ''}`} onPointerDown={onPointerDown}>
        <span class="grip">
          <Icon name="grip" size={14} />
        </span>
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected={s.tab === 'inspect'} class={`tab ${s.tab === 'inspect' ? 'on' : ''}`} onClick={() => ctl.set({ tab: 'inspect' })}>
            Inspect
          </button>
          <button role="tab" aria-selected={s.tab === 'changes'} class={`tab ${s.tab === 'changes' ? 'on' : ''}`} onClick={() => ctl.set({ tab: 'changes' })}>
            Changes {s.changes.length > 0 && <span class="ct">{s.changes.length}</span>}
          </button>
        </div>
        <div class="tools">
          <button class={`ib ${s.selecting ? 'on' : ''}`} title="Select an element" aria-pressed={s.selecting} onClick={() => ctl.toggleSelecting()}>
            <Icon name="pointer" />
          </button>
          <button class={`ib ${s.frozen ? 'on' : ''}`} title={s.frozen ? 'Unfreeze page' : 'Freeze page'} aria-pressed={s.frozen} onClick={() => ctl.toggleFreeze()}>
            <Icon name="snowflake" />
          </button>
          <button class="ib" title="Close" onClick={() => ctl.closePanel()}>
            <Icon name="x" />
          </button>
        </div>
      </div>
      {s.tab === 'inspect' ? (
        <div class="p-body">
          <Layers ctl={ctl} s={s} />
          <Inspector ctl={ctl} s={s} />
        </div>
      ) : (
        <Changes ctl={ctl} s={s} />
      )}
    </div>
  )
}

function clampToViewport(pos: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(pos.x, EDGE), window.innerWidth - PANEL_WIDTH - EDGE),
    y: Math.min(Math.max(pos.y, EDGE), window.innerHeight - 80),
  }
}

/** What's selected: where it sits and is written, what it is, its properties, text, classes and styles. */
function Inspector({ ctl, s }: { ctl: Controller; s: State }) {
  const node = s.selected
  if (!node) {
    return (
      <div class="blank">
        <Icon name="pointer" size={24} />
        Nothing selected.
        <br />
        Press the arrow above, then click anything on the page.
      </div>
    )
  }

  const path = ancestorsOf(node, s.filter)
  const shown = path.slice(-3)
  const rect = rectOf(node)
  const hosts = hostsOf(node)
  const src = srcOf(node)
  const info = node.kind === 'component' ? ctl.componentInfo(node) : null
  const classes = node.element ? Array.from(node.element.classList) : []
  const text = textNodeOf(node)
  const textChange = ctl.changeFor(node, 'text')

  return (
    <>
      <div class="sec">
        {path.length > 0 && (
          <div class="crumbs">
            {path.length > shown.length && <span>… ›</span>}
            {shown.map((ancestor) => (
              <>
                <button onClick={() => ctl.select(ancestor)}>{ancestor.name}</button>
                <span>›</span>
              </>
            ))}
            <b>{node.name}</b>
          </div>
        )}
        <div class="sel-h">
          <span class="name">{node.name}</span>
          <span class={`kind ${node.kind === 'tag' ? 'tag' : ''}`}>{node.kind === 'component' ? 'Component' : 'HTML tag'}</span>
        </div>
        {src && (
          <div class="src" title={src}>
            <Icon name="file" size={13} />
            {node.kind === 'component' ? 'Used at ' : ''}
            {shortSrc(src)}
          </div>
        )}
        {info && (
          <div class="src" title={`${info.file}:${info.line}`}>
            <Icon name="component" size={13} />
            Defined in {shortSrc(`${info.file}:${info.line}`)}
          </div>
        )}
        <div class="facts">
          {rect ? <span>{`${Math.round(rect.width)} × ${Math.round(rect.height)}`}</span> : <span>not visible</span>}
          {node.kind === 'component' && hosts.length > 0 && (
            <span>
              draws {hosts.slice(0, 3).map((h) => `<${h.localName}>`).join(' ')}
              {hosts.length > 3 ? ` +${hosts.length - 3}` : ''}
            </span>
          )}
        </div>
        <div class="row force">
          <span class="l">Show as</span>
          <div class="seg wide" role="radiogroup" aria-label="Show as">
            {(['none', 'hover', 'pressed'] as const).map((state) => (
              <button key={state} role="radio" aria-checked={s.forced === state} class={s.forced === state ? 'on' : ''} onClick={() => ctl.setForced(state)}>
                {state === 'none' ? 'Normal' : state === 'hover' ? 'Hover' : 'Pressed'}
              </button>
            ))}
          </div>
        </div>
        {s.forced !== 'none' && <div class="note">Showing the {s.forced === 'hover' ? 'hover' : 'pressed'} look. Style edits still change the normal state.</div>}
      </div>

      {node.kind === 'component' && <Properties ctl={ctl} s={s} node={node} />}

      {text && (
        <div class="sec">
          <div class="sec-h">
            <Icon name="text" size={13} /> Content
          </div>
          <div class="row">
            <span class={`l ${textChange ? 'ov' : ''}`}>Text</span>
            <div class="ctl">
              <input
                class="input"
                value={textChange?.after.css ?? text.data}
                onInput={(e) => ctl.setText(node, e.currentTarget.value)}
                aria-label="Text"
              />
              {textChange && (
                <button class="ib sm" title="Reset" onClick={() => ctl.undoChange(textChange.id)}>
                  <Icon name="undo" size={14} />
                </button>
              )}
            </div>
          </div>
          {textChange && <ScopeChip ctl={ctl} change={textChange} />}
        </div>
      )}

      {classes.length > 0 && (
        <div class="sec">
          <div class="sec-h">
            <Icon name="tags" size={13} /> Classes
          </div>
          <div class="chips">
            {classes.map((name) => (
              <span class="chip" key={name}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <Styles ctl={ctl} s={s} node={node} />
    </>
  )
}
