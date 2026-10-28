import { useEffect, useReducer, useRef, useState } from 'preact/hooks'
import type { Controller, State } from '../controller'
import { Icon } from './Icon'
import { Overlay } from './Overlay'
import { Panel } from './Panel'
import { Picker } from './Picker'

function useControllerState(ctl: Controller): State {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => ctl.subscribe(() => rerender(undefined)), [ctl])
  return ctl.state
}

export function App({ ctl }: { ctl: Controller }) {
  const s = useControllerState(ctl)
  if (!s.enabled) return null

  return (
    <div class="root">
      <Overlay ctl={ctl} />
      {s.selecting && <SelectHint />}
      {/* The round button steps aside while the panel is open; the panel's ✕ brings it back. */}
      {s.panelOpen ? <Panel ctl={ctl} s={s} /> : <Launcher ctl={ctl} s={s} />}
      {s.panelOpen && s.picker && <Picker ctl={ctl} s={s} />}
      {s.toast && (
        <div class="toast" role="status">
          {s.toast.text}
          {s.toast.action && (
            <button class="toast-act" onClick={s.toast.action.run}>
              {s.toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Where the round button sits, remembered per browser so it stays clear of each app's own corner controls. */
const LAUNCHER_KEY = 'design-mode:launcher'
const LAUNCHER_SIZE = { width: 72, height: 44 }
const DEFAULT_SPOT = { right: 16, bottom: 16 }

function savedSpot(): { right: number; bottom: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(LAUNCHER_KEY) ?? 'null')
    if (typeof saved?.right === 'number' && typeof saved?.bottom === 'number') return saved
  } catch {
    // Storage blocked or unreadable: the default corner is fine.
  }
  return DEFAULT_SPOT
}

function clampSpot(spot: { right: number; bottom: number }) {
  return {
    right: Math.min(Math.max(spot.right, 8), window.innerWidth - LAUNCHER_SIZE.width - 8),
    bottom: Math.min(Math.max(spot.bottom, 8), window.innerHeight - LAUNCHER_SIZE.height - 8),
  }
}

/**
 * The round button, bottom right by default. One click goes straight into select
 * mode; the small arrow opens the menu. Drag it (by either half) to move it out of
 * the way of the app's own controls; it remembers where you left it.
 */
function Launcher({ ctl, s }: { ctl: Controller; s: State }) {
  const [spot, setSpot] = useState(savedSpot)
  const dragged = useRef(false)
  const at = clampSpot(spot)

  const onPointerDown = (e: PointerEvent) => {
    const start = { x: e.clientX, y: e.clientY, ...at }
    dragged.current = false
    let latest = at
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      // A few pixels of wobble is still a click.
      if (!dragged.current && Math.hypot(dx, dy) < 5) return
      dragged.current = true
      latest = clampSpot({ right: start.right - dx, bottom: start.bottom - dy })
      setSpot(latest)
    }
    const up = () => {
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      // The release after a drag doesn't produce a click on the button, so nothing would reset this.
      if (dragged.current) setTimeout(() => (dragged.current = false), 0)
      if (dragged.current) {
        try {
          localStorage.setItem(LAUNCHER_KEY, JSON.stringify(latest))
        } catch {
          // Not remembered across reloads, but it still moved.
        }
      }
    }
    // Followed on the window rather than captured on the button: capturing would send
    // the release to the button's container and lose the click on a plain press. In
    // the capture phase, because the release usually lands on the tool, whose events
    // are stopped before they bubble up to the window.
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
  }

  /** Runs a click only when the press wasn't a drag. */
  const click = (run: () => void) => () => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    run()
  }

  // The menu opens towards the middle of the screen: above the button, unless it's near the top.
  const menuAbove = at.bottom + LAUNCHER_SIZE.height < window.innerHeight - 260
  const menuStyle = menuAbove
    ? { right: `${at.right}px`, bottom: `${at.bottom + LAUNCHER_SIZE.height + 8}px` }
    : { right: `${at.right}px`, top: `${window.innerHeight - at.bottom + 8}px` }

  return (
    <>
      {s.menuOpen && (
        <div class="menu" role="menu" style={menuStyle}>
          <button class="it" role="menuitem" onClick={() => ctl.openPanel()}>
            <Icon name="panel" /> Open panel
          </button>
          {s.changes.length > 0 && (
            <button class="it" role="menuitem" onClick={() => void ctl.copyPrompt()}>
              <Icon name="copy" /> Copy prompt for Claude
            </button>
          )}
          {s.changes.length > 0 && (
            <button class="it" role="menuitem" onClick={() => ctl.toggleHidden()}>
              <Icon name={s.hidden ? 'eye' : 'eye-off'} /> {s.hidden ? 'Show my changes' : 'Hide my changes'}
            </button>
          )}
          <button class="it" role="menuitem" onClick={() => ctl.toggleEnabled()}>
            <Icon name="power" /> Turn off Design mode
          </button>
          <div class="foot">
            <span>Drag the button to move it</span>
            <span>
              <kbd>⌥</kbd>
              <kbd>⇧</kbd>
              <kbd>D</kbd>
            </span>
          </div>
        </div>
      )}
      <div class={`fab ${s.selecting ? 'on' : ''}`} style={{ right: `${at.right}px`, bottom: `${at.bottom}px` }} onPointerDown={onPointerDown}>
        <button class="main" title={s.selecting ? 'Stop selecting' : 'Select an element (drag to move)'} aria-pressed={s.selecting} onClick={click(() => ctl.toggleSelecting())}>
          <Icon name="pointer" size={20} />
        </button>
        {s.changes.length > 0 && <span class="badge">{s.changes.length}</span>}
        <button class="more" title="More" aria-expanded={s.menuOpen} onClick={click(() => ctl.set({ menuOpen: !s.menuOpen }))}>
          <Icon name={s.menuOpen ? 'chevron-down' : 'chevron-up'} size={14} />
        </button>
      </div>
    </>
  )
}

function SelectHint() {
  return (
    <div class="hint" role="status">
      <span>
        <b>Click</b> select
      </span>
      <span class="sep">·</span>
      <span>
        <b>⌥ Click</b> select the tag, not the component
      </span>
      <span class="sep">·</span>
      <span>
        <b>↑</b> parent
      </span>
      <span class="sep">·</span>
      <span>
        <b>Esc</b> stop
      </span>
      <span class="shield">
        <Icon name="shield" size={13} /> The app is paused for input: clicks won't press buttons, keys won't play notes.
      </span>
    </div>
  )
}
