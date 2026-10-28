import type { Fiber } from './fiber'

/**
 * Changing a component's props while the app runs.
 *
 * Two mechanisms, because a prop can be changed for different scopes:
 *
 * 1. Rules, for "every one from this line" and "every Button with variant = primary".
 *    The plugin routes every component's props through `__dm(src, name, props)` (see
 *    jsx.ts), so a rule here rewrites the props each time the parent renders. That
 *    makes it stick however often the app re-renders.
 *
 * 2. React's own dev hook, for "only this one" when one line of code draws several
 *    (a list). React's dev build hands its internals to whatever sits at
 *    `__REACT_DEVTOOLS_GLOBAL_HOOK__`, the slot React DevTools uses, including
 *    `overrideProps`, which re-renders one component with a changed prop. That only
 *    lasts until its parent renders again, so the controller re-applies it after
 *    every React commit. This is also how rule changes show up immediately rather
 *    than at the parent's next render.
 */

export interface PropRule {
  /** Matches components written on this line… */
  src?: string
  /** …or every component with this name… */
  name?: string
  /** …whose prop currently has this value (`fallback` stands in when it isn't passed, i.e. the default). */
  when?: { prop: string; value: unknown; fallback: unknown; onlyUnset?: boolean }
  prop: string
  value: unknown
}

let rules: PropRule[] = []

export function setPropRules(next: PropRule[]) {
  rules = next
}

declare global {
  interface Window {
    __dm?: (src: string, name: string, props: Record<string, unknown>) => Record<string, unknown>
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevtoolsHook
  }
}

/** Called by the plugin's rewritten JSX for every component element, on every render. */
function routeProps(src: string, name: string, props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...props, 'data-dm-src': src }
  for (const rule of rules) {
    if (rule.src !== undefined ? rule.src !== src : rule.name !== name) continue
    if (rule.when) {
      const given = props[rule.when.prop]
      if (rule.when.onlyUnset ? given !== undefined : (given === undefined ? rule.when.fallback : given) !== rule.when.value) continue
    }
    // `null` stands for "not set", so the component's own default applies.
    out[rule.prop] = rule.value === null ? undefined : rule.value
  }
  return out
}

interface Renderer {
  overrideProps?: (fiber: Fiber, path: (string | number)[], value: unknown) => void
}

interface DevtoolsHook {
  renderers?: Map<number, Renderer>
  inject: (renderer: Renderer) => number
  onCommitFiberRoot?: (...args: unknown[]) => void
  [key: string]: unknown
}

const renderers: Renderer[] = []
const commitListeners = new Set<() => void>()

/**
 * Sets up `__dm` and takes a seat on React's dev hook. Must run before React loads,
 * which is why the plugin puts this script first in <head>. If React DevTools or React
 * Refresh already created the hook, this wraps theirs instead of replacing it.
 */
export function installLiveProps() {
  window.__dm = routeProps

  let hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (!hook) {
    let nextId = 1
    const noop = () => {}
    hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(),
      supportsFiber: true,
      isDisabled: false,
      inject(this: DevtoolsHook, renderer: Renderer) {
        const id = nextId++
        this.renderers?.set(id, renderer)
        return id
      },
      onCommitFiberRoot: noop,
      onCommitFiberUnmount: noop,
      onPostCommitFiberRoot: noop,
      checkDCE: noop,
      setStrictMode: noop,
    }
  }
  for (const renderer of hook.renderers?.values() ?? []) renderers.push(renderer)

  const inject = hook.inject
  hook.inject = function (this: DevtoolsHook, renderer: Renderer) {
    renderers.push(renderer)
    return inject.call(this, renderer)
  }
  const onCommit = hook.onCommitFiberRoot
  hook.onCommitFiberRoot = function (this: DevtoolsHook, ...args: unknown[]) {
    const result = onCommit?.apply(this, args)
    for (const listener of commitListeners) listener()
    return result
  }
}

export function onReactCommit(listener: () => void): () => void {
  commitListeners.add(listener)
  return () => commitListeners.delete(listener)
}

/** Re-renders one component with one prop changed. False when React's dev hook isn't available. */
export function overrideProp(fiber: Fiber, prop: string, value: unknown): boolean {
  const renderer = renderers.find((r) => typeof r.overrideProps === 'function')
  if (!renderer) return false
  try {
    renderer.overrideProps!(fiber, [prop], value)
    return true
  } catch {
    return false
  }
}
