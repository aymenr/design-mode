import { componentName, findRootFibers, isComponent, isHost, type Fiber } from './fiber'

/**
 * The layers tree: the page as a nested list of components and HTML tags.
 *
 * On a React page it comes from React's fiber tree, so components show up by name.
 * On any other page it falls back to the DOM, where everything is a tag.
 */
export interface LayerNode {
  /** Path of names from the root, e.g. `/App[0]/Card[2]/button[0]`. Stable across rebuilds while the page keeps its shape. */
  id: string
  kind: 'component' | 'tag'
  name: string
  parent: LayerNode | null
  children: LayerNode[]
  fiber: Fiber | null
  /** Tags only: the element itself. */
  element: Element | null
}

export interface LayerTree {
  roots: LayerNode[]
  byId: Map<string, LayerNode>
  /** Every element in the tree, mapped to its tag node. */
  byElement: Map<Element, LayerNode>
  /** Whether the tree came from React (and so has components). */
  react: boolean
}

export type Filter = 'components' | 'all'

const SKIPPED_TAGS = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template', 'head', 'title'])

export function buildTree(ignore: Element): LayerTree {
  const tree: LayerTree = { roots: [], byId: new Map(), byElement: new Map(), react: false }

  const add = (
    kind: LayerNode['kind'],
    name: string,
    fiber: Fiber | null,
    element: Element | null,
    parent: LayerNode | null,
    siblings: LayerNode[],
  ): LayerNode => {
    const index = siblings.filter((s) => s.name === name).length
    const node: LayerNode = {
      id: `${parent?.id ?? ''}/${name}[${index}]`,
      kind,
      name,
      parent,
      children: [],
      fiber,
      element,
    }
    siblings.push(node)
    tree.byId.set(node.id, node)
    if (element) tree.byElement.set(element, node)
    return node
  }

  // Everything React renders that isn't a component or an element (fragments,
  // context providers, Suspense, portals) is skipped over: its children are lifted
  // into whatever node sits above it.
  const walkFiber = (first: Fiber | null, parent: LayerNode | null, siblings: LayerNode[]) => {
    for (let fiber = first; fiber; fiber = fiber.sibling) {
      if (isComponent(fiber)) {
        const name = componentName(fiber)
        if (name) {
          const node = add('component', name, fiber, null, parent, siblings)
          walkFiber(fiber.child, node, node.children)
          continue
        }
      } else if (isHost(fiber)) {
        const element = fiber.stateNode as Element
        if (element === ignore) continue
        const node = add('tag', element.localName, fiber, element, parent, siblings)
        walkFiber(fiber.child, node, node.children)
        continue
      }
      walkFiber(fiber.child, parent, siblings)
    }
  }

  const walkDom = (elements: Iterable<Element>, parent: LayerNode | null, siblings: LayerNode[]) => {
    for (const element of elements) {
      if (element === ignore || SKIPPED_TAGS.has(element.localName)) continue
      const node = add('tag', element.localName, null, element, parent, siblings)
      walkDom(element.children, node, node.children)
    }
  }

  const roots = findRootFibers()
  if (roots.length > 0) {
    tree.react = true
    for (const root of roots) walkFiber(root.child, null, tree.roots)
  } else {
    walkDom(document.body.children, null, tree.roots)
  }
  return tree
}

/** The top-level DOM elements a node draws: itself for a tag, its outermost elements for a component. */
export function hostsOf(node: LayerNode): Element[] {
  if (node.element) return [node.element]
  return node.children.flatMap(hostsOf)
}

/** The box around everything a node draws, or null when none of it is visible. */
export function rectOf(node: LayerNode): DOMRect | null {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const host of hostsOf(node)) {
    const r = host.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    left = Math.min(left, r.left)
    top = Math.min(top, r.top)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }
  return left === Infinity ? null : new DOMRect(left, top, right - left, bottom - top)
}

/** The tag node for an element, or for its closest ancestor the tree knows about. */
export function nodeForElement(tree: LayerTree, element: Element | null): LayerNode | null {
  for (let el = element; el; el = el.parentElement) {
    const node = tree.byElement.get(el)
    if (node) return node
  }
  return null
}

export function nearestComponent(node: LayerNode): LayerNode | null {
  for (let n: LayerNode | null = node; n; n = n.parent) if (n.kind === 'component') return n
  return null
}

/** Children as the tree shows them: with the components filter, tags are skipped and their children lifted up. */
export function visibleChildren(node: LayerNode | null, tree: LayerTree, filter: Filter): LayerNode[] {
  const children = node ? node.children : tree.roots
  if (filter === 'all') return children
  return children.flatMap((child) => (child.kind === 'component' ? [child] : visibleChildren(child, tree, filter)))
}

export function visibleParent(node: LayerNode, filter: Filter): LayerNode | null {
  for (let p = node.parent; p; p = p.parent) if (filter === 'all' || p.kind === 'component') return p
  return null
}

/** Root-first list of a node's visible ancestors. */
export function ancestorsOf(node: LayerNode, filter: Filter): LayerNode[] {
  const path: LayerNode[] = []
  for (let p = visibleParent(node, filter); p; p = visibleParent(p, filter)) path.unshift(p)
  return path
}

/** A short piece of the text a node shows, to tell repeated rows apart ("Practice", "Edit"). */
export function labelOf(node: LayerNode): string {
  const text = hostsOf(node)
    .map((el) => el.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 24 ? `${text.slice(0, 23)}…` : text
}

/** One row of siblings: a single node, or a run of same-named siblings shown as "Card ×3". */
export type Run = { key: string; nodes: LayerNode[] }

export function runsOf(nodes: LayerNode[]): Run[] {
  const runs: Run[] = []
  for (const node of nodes) {
    const last = runs[runs.length - 1]
    if (last && last.nodes[0].name === node.name && last.nodes[0].kind === node.kind) last.nodes.push(node)
    else runs.push({ key: `${node.id}#run`, nodes: [node] })
  }
  return runs
}
