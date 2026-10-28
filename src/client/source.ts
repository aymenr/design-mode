import type { LayerNode, LayerTree } from './tree'

/**
 * Where things were written, from the `data-dm-src` the plugin adds: on an HTML
 * element as an attribute, on a component as a prop.
 */
export const SRC_ATTR = 'data-dm-src'

/** `src/ui/kit/Card.tsx:36:5` → where this node was written: for a component, the place it's used. */
export function srcOf(node: LayerNode): string | null {
  if (node.element) return node.element.getAttribute(SRC_ATTR)
  const value = node.fiber?.memoizedProps?.[SRC_ATTR]
  return typeof value === 'string' ? value : null
}

/** `src/ui/kit/Card.tsx:36:5` → `kit/Card.tsx:36`: short enough for the panel. */
export function shortSrc(src: string | null): string {
  if (!src) return ''
  const [file, line] = src.split(':')
  return `${file.replace(/^src\//, '')}${line ? `:${line}` : ''}`
}

/** `src/ui/kit/Card.tsx:36:5` → `src/ui/kit/Card.tsx:36`: what the prompt says. */
export function fileLine(src: string | null): string {
  if (!src) return ''
  const [file, line] = src.split(':')
  return line ? `${file}:${line}` : file
}

export function fileOf(src: string | null): string | null {
  return src ? src.split(':')[0] : null
}

/** Every component in the tree with this name. */
export function componentsNamed(tree: LayerTree, name: string): LayerNode[] {
  const found: LayerNode[] = []
  for (const node of tree.byId.values()) if (node.kind === 'component' && node.name === name) found.push(node)
  return found
}

/** Every node written at the same place in the code: the instances one line draws, e.g. in a list. */
export function sameSource(tree: LayerTree, node: LayerNode): LayerNode[] {
  const src = srcOf(node)
  if (!src) return [node]
  const found: LayerNode[] = []
  for (const other of tree.byId.values()) if (other.kind === node.kind && srcOf(other) === src) found.push(other)
  return found
}

/** The file a component is defined in, judged by the elements it draws itself (its "owned" children). */
export function definitionHint(node: LayerNode): string | null {
  const fiber = node.fiber as { _debugOwner?: unknown; alternate?: unknown } | null
  if (!fiber) return null
  const queue = [...node.children]
  for (let i = 0; i < queue.length && i < 200; i++) {
    const child = queue[i]
    const owner = (child.fiber as { _debugOwner?: unknown } | null)?._debugOwner
    if (owner && (owner === fiber || owner === fiber.alternate)) {
      const file = fileOf(srcOf(child))
      if (file) return file
    }
    queue.push(...child.children)
  }
  return null
}
