/**
 * Reading React's internal tree.
 *
 * React keeps a "fiber" for every component and element it renders: the record of
 * what it rendered, with which props, and where it sits among its parent's children.
 * It hangs that record on each DOM node it creates, under a key like
 * `__reactFiber$x7k2`, and the whole tree on the element the app was mounted into,
 * under `__reactContainer$x7k2`.
 *
 * None of this is public API. It's what React DevTools reads, and it has held still
 * from React 16 to 19. Every read here is defensive, so if React changes it the tool
 * degrades to "no components found" instead of breaking the page.
 */
export interface Fiber {
  tag: number
  type: unknown
  stateNode: unknown
  return: Fiber | null
  child: Fiber | null
  sibling: Fiber | null
  memoizedProps: Record<string, unknown> | null
}

// React's own numbering for fiber kinds.
const FUNCTION_COMPONENT = 0
const CLASS_COMPONENT = 1
const HOST_COMPONENT = 5
const FORWARD_REF = 11
const SIMPLE_MEMO_COMPONENT = 15
const HOST_HOISTABLE = 26
const HOST_SINGLETON = 27

/**
 * A component someone wrote. `memo(...)` wrappers (tag 14) are left out on purpose:
 * the component inside them gets its own fiber, and counting both would show every
 * memoised component twice.
 */
export function isComponent(fiber: Fiber): boolean {
  return (
    fiber.tag === FUNCTION_COMPONENT ||
    fiber.tag === CLASS_COMPONENT ||
    fiber.tag === FORWARD_REF ||
    fiber.tag === SIMPLE_MEMO_COMPONENT
  )
}

/** A real DOM element (`div`, `button`, …). */
export function isHost(fiber: Fiber): boolean {
  return (
    (fiber.tag === HOST_COMPONENT || fiber.tag === HOST_HOISTABLE || fiber.tag === HOST_SINGLETON) &&
    fiber.stateNode instanceof Element
  )
}

export function componentName(fiber: Fiber): string | null {
  return nameOf(fiber.type, 0)
}

function nameOf(type: unknown, depth: number): string | null {
  if (!type || depth > 3) return null
  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string }
    return fn.displayName || fn.name || null
  }
  if (typeof type === 'object') {
    // forwardRef keeps the component under `render`, memo under `type`.
    const wrapper = type as { displayName?: string; render?: unknown; type?: unknown }
    return wrapper.displayName || nameOf(wrapper.render, depth + 1) || nameOf(wrapper.type, depth + 1)
  }
  return null
}

/** The current root fiber of every React app mounted on the page. */
export function findRootFibers(): Fiber[] {
  const roots: Fiber[] = []
  // Apps mount into <body> or an element at most two levels below it.
  const candidates = [document.body, ...Array.from(document.body.querySelectorAll(':scope > *, :scope > * > *'))]
  for (const element of candidates) {
    for (const key of Object.keys(element)) {
      if (!key.startsWith('__reactContainer$')) continue
      const fiber = (element as unknown as Record<string, Fiber | null>)[key]
      // The container holds the root fiber from when it mounted; its `stateNode` is
      // React's root record, whose `current` is the fiber for what's on screen now.
      const root = fiber?.stateNode as { current?: Fiber } | undefined
      const current = root?.current ?? fiber
      if (current) roots.push(current)
    }
  }
  return roots
}
