import { useState } from 'preact/hooks'
import type { Controller } from '../controller'
import type { Change } from '../overrides'
import { Icon } from './Icon'

/**
 * The chip under an edited row saying who the edit applies to. Clicking it lists
 * the other choices, each spelling out what it means for the code; hovering one
 * outlines everything on the page it would cover.
 */
export function ScopeChip({ ctl, change }: { ctl: Controller; change: Change }) {
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const options = ctl.scopeOptions(change)
  const close = () => {
    setMenu(null)
    ctl.set({ scopePreview: null })
  }

  if (options.length <= 1) {
    return (
      <div class="scope">
        <span class="chip" title={change.scope.detail}>
          {change.scope.label}
        </span>
      </div>
    )
  }

  return (
    <div class="scope">
      <button
        class={`chip ${change.scope.kind === 'instance' ? '' : 'wide'}`}
        title={change.scope.detail}
        aria-expanded={!!menu}
        onClick={(e) => setMenu(menu ? null : (e.currentTarget as Element).getBoundingClientRect())}
      >
        {change.scope.label} <Icon name={menu ? 'chevron-up' : 'chevron-down'} size={12} />
      </button>
      {menu && (
        <>
          <div class="backdrop" onPointerDown={close} />
          <div class="pop scope-menu" style={{ top: `${menu.bottom + 4}px`, left: `${Math.max(8, Math.min(menu.left, window.innerWidth - 288))}px`, width: '280px' }} role="menu">
            {options.map((option) => {
              const current = option.kind === change.scope.kind && option.label === change.scope.label
              return (
                <button
                  key={`${option.kind}${option.label}`}
                  class={`scope-op ${current ? 'cur' : ''}`}
                  role="menuitemradio"
                  aria-checked={current}
                  onPointerEnter={() => ctl.set({ scopePreview: ctl.scopeTargets(change, option) })}
                  onPointerLeave={() => ctl.set({ scopePreview: null })}
                  onClick={() => {
                    ctl.setScope(change.id, option)
                    close()
                  }}
                >
                  <span class="scope-l">
                    {option.label}
                    {current && <Icon name="check" size={13} class="tick" />}
                  </span>
                  {option.detail && <span class="scope-d">{option.detail}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
