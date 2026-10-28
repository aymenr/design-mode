import { allRules, FORCE_SHEET_ID } from './cascade'

export type ForcedState = 'none' | 'hover' | 'pressed'

const PSEUDO: Record<Exclude<ForcedState, 'none'>, { pseudo: RegExp; attr: string }> = {
  hover: { pseudo: /:hover\b/g, attr: 'data-dm-hover' },
  pressed: { pseudo: /:active\b/g, attr: 'data-dm-active' },
}

let sheet: HTMLStyleElement | null = null
let marked: Element[] = []

/**
 * Shows an element as if hovered or pressed, the way Chrome DevTools' "force state"
 * does, so you can see and inspect that look without holding the mouse on it.
 *
 * Every rule written for `:hover` (or `:active`) is copied with the pseudo-class
 * swapped for an attribute, and that attribute is put on the element and everything
 * above it, since hovering something also hovers its parents.
 */
export function forceState(element: Element | null, state: ForcedState) {
  for (const el of marked) {
    el.removeAttribute(PSEUDO.hover.attr)
    el.removeAttribute(PSEUDO.pressed.attr)
  }
  marked = []
  if (!sheet) {
    sheet = document.createElement('style')
    sheet.id = FORCE_SHEET_ID
  }
  if (!sheet.isConnected) document.head.append(sheet)
  if (!element || state === 'none') {
    sheet.textContent = ''
    return
  }

  const { pseudo, attr } = PSEUDO[state]
  const css: string[] = []
  for (const rule of allRules()) {
    if (!pseudo.test(rule.selectorText)) continue
    pseudo.lastIndex = 0
    const parts = rule.selectorText
      .split(',')
      .filter((part) => part.match(pseudo))
      .map((part) => part.replace(pseudo, `[${attr}]`))
    pseudo.lastIndex = 0
    if (parts.length > 0 && rule.style.cssText) css.push(`${parts.join(', ')} { ${rule.style.cssText} }`)
  }
  sheet.textContent = css.join('\n')

  for (let el: Element | null = element; el; el = el.parentElement) {
    el.setAttribute(attr, '')
    marked.push(el)
  }
}
