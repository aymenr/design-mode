import type { Controller, State } from '../controller'
import type { Change } from '../overrides'
import type { Value } from '../properties'
import { Icon } from './Icon'

/** The Changes tab: every edit, grouped by what it was made on, each one switchable, findable and undoable. */
export function Changes({ ctl, s }: { ctl: Controller; s: State }) {
  if (s.changes.length === 0) {
    return (
      <div class="p-body">
        <div class="blank">
          <Icon name="pointer" size={24} />
          No changes yet.
          <br />
          Select something on the page to start.
        </div>
      </div>
    )
  }

  const groups: { key: string; first: Change; changes: Change[] }[] = []
  for (const change of s.changes) {
    const group = groups.find((g) => g.key === change.nodeId)
    if (group) group.changes.push(change)
    else groups.push({ key: change.nodeId, first: change, changes: [change] })
  }
  const anyOff = s.changes.some((c) => !c.enabled)

  return (
    <>
      <div class="p-body">
        <div class="sec">
          {s.hidden && <div class="note banner">All changes are hidden. The page shows the original.</div>}
          {groups.map(({ key, first, changes }) => (
            <div class="chg" key={key}>
              <div class="chg-h">
                <Icon name={first.nodeKind === 'component' ? 'component' : 'code'} size={13} class={first.nodeKind === 'component' ? 'k' : ''} />
                {first.path}
              </div>
              {changes.map((change) => (
                <div class={`chg-i ${change.enabled ? '' : 'off'}`} key={change.id}>
                  <div class="chg-t">
                    <span class="w">{change.label}</span>
                    <span class="scope-t" title={change.scope.detail}>
                      {change.scope.label}
                    </span>
                    <div class="d">
                      <s>{short(change.before)}</s> → {short(change.after)}
                    </div>
                  </div>
                  <div class="act">
                    <button class={`ib sm ${change.enabled ? '' : 'on'}`} title={change.enabled ? 'Turn off to compare' : 'Turn back on'} onClick={() => ctl.toggleChange(change.id)}>
                      <Icon name={change.enabled ? 'eye' : 'eye-off'} size={14} />
                    </button>
                    <button class="ib sm" title="Show on page" onClick={() => ctl.showChange(change)}>
                      <Icon name="focus" size={14} />
                    </button>
                    <span class="gap" />
                    <button class="ib sm" title="Undo" onClick={() => ctl.undoChange(change.id)}>
                      <Icon name="undo" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {anyOff && <div class="note">Changes switched off show the original on the page, and stay out of the prompt.</div>}
        </div>
        <PromptPreview ctl={ctl} s={s} />
      </div>
      <div class="p-foot">
        <button class="pbtn danger" onClick={() => ctl.discardAll()}>
          <Icon name="trash" size={14} /> Discard all
        </button>
        <button class={`ib ${s.hidden ? 'on' : ''}`} title={s.hidden ? 'Show my changes' : 'Hide my changes'} onClick={() => ctl.toggleHidden()} aria-pressed={s.hidden}>
          <Icon name={s.hidden ? 'eye' : 'eye-off'} size={15} />
        </button>
        <button class="pbtn blue" onClick={() => void ctl.copyPrompt()}>
          <Icon name="copy" size={14} /> Copy prompt
        </button>
      </div>
    </>
  )
}

/** The prompt as it will be copied, so you can check it reads right before pasting. */
function PromptPreview({ ctl, s }: { ctl: Controller; s: State }) {
  const open = s.promptOpen
  return (
    <div class="sec">
      <button class="grp-h" aria-expanded={open} onClick={() => ctl.set({ promptOpen: !open })}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} /> Prompt preview
      </button>
      {open && <pre class="prompt">{ctl.prompt() || 'Every change is switched off, so there is nothing to send.'}</pre>}
    </div>
  )
}

function short(value: Value): string {
  if (value.token) return value.token
  const text = value.display || 'none'
  return text.length > 28 ? `${text.slice(0, 27)}…` : text
}
