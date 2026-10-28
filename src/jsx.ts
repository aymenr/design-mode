import { parse } from '@babel/parser'
import type { JSXAttribute, JSXElement, JSXOpeningElement, JSXSpreadAttribute, Node } from '@babel/types'
import MagicString from 'magic-string'

/** The attribute every element gets: where it was written, as `file:line:column`. */
export const SRC_ATTR = 'data-dm-src'

/**
 * Rewrites one source file so every JSX element carries where it was written.
 *
 * - An HTML element gets `data-dm-src="file:line:col"` as its last attribute (last,
 *   so a `{...rest}` spread from the component above can't overwrite it).
 * - A component gets its props passed through `__dm(src, name, props)`, which the
 *   client defines. That adds the same `data-dm-src` prop, and is also how a prop
 *   you change in the panel stays changed every time the component re-renders.
 *
 * React 19 stopped recording where elements were written, so this is the only way
 * to get an exact file and line. It runs in dev only, before React's own transform.
 */
export function addSourceInfo(code: string, file: string): { code: string; map: ReturnType<MagicString['generateMap']> } | null {
  let ast: Node
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true }) as unknown as Node
  } catch {
    return null
  }

  const s = new MagicString(code)
  let changed = false
  let usesHelper = false

  // Children first, so an element inside another element's props is rewritten
  // before the outer element's props are copied.
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    const n = node as Node
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue
      visit((n as unknown as Record<string, unknown>)[key])
    }
    if (n.type === 'JSXElement') {
      if (rewrite(n, s, file)) {
        changed = true
        if (isComponentName(nameOf(n.openingElement))) usesHelper = true
      }
    }
  }
  visit(ast)

  if (!changed) return null
  if (usesHelper) {
    s.prepend(`const __dmProps = (s, n, p) => (globalThis.__dm ? globalThis.__dm(s, n, p) : p);\n`)
  }
  return { code: s.toString(), map: s.generateMap({ hires: true, source: file, includeContent: true }) }
}

function nameOf(opening: JSXOpeningElement): string {
  const name = opening.name
  if (name.type === 'JSXIdentifier') return name.name
  if (name.type === 'JSXNamespacedName') return `${name.namespace.name}:${name.name.name}`
  const parts: string[] = []
  let current: typeof name.object | typeof name = name
  while (current.type === 'JSXMemberExpression') {
    parts.unshift(current.property.name)
    current = current.object
  }
  parts.unshift(current.name)
  return parts.join('.')
}

/** `Button`, `Kit.Button` and `motion.div` are components; `div` and `svg:path` are tags. */
function isComponentName(name: string): boolean {
  return name.includes('.') || /^[A-Z]/.test(name)
}

function rewrite(element: JSXElement, s: MagicString, file: string): boolean {
  const opening = element.openingElement
  const name = nameOf(opening)
  // Fragments accept nothing but `key` and `children`, and draw nothing to point at.
  if (name === 'Fragment' || name.endsWith('.Fragment')) return false
  if (!opening.loc || opening.start == null || opening.end == null) return false
  if (opening.attributes.some((a) => a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' && a.name.name === SRC_ATTR)) return false

  const src = `${file}:${opening.loc.start.line}:${opening.loc.start.column + 1}`
  const end = opening.end - (opening.selfClosing ? 2 : 1)

  if (!isComponentName(name)) {
    s.appendLeft(end, ` ${SRC_ATTR}="${src}"`)
    return true
  }

  // `key` has to stay a real attribute: React warns when it arrives inside a spread.
  const attrs = opening.attributes
  const key = attrs.find((a): a is JSXAttribute => a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' && a.name.name === 'key')
  const props = attrs.filter((a) => a !== key)
  const entries = props.map((a) => propEntry(a, s)).filter((e): e is string => e !== null)
  const call = ` {...__dmProps(${JSON.stringify(src)}, ${JSON.stringify(name)}, {${entries.join(', ')}})}`

  if (props.length === 0) {
    s.appendLeft(end, call)
  } else {
    // Replace the props in place. The key, if any, is put back in front.
    const start = Math.min(...props.map((a) => a.start!))
    const stop = Math.max(...props.map((a) => a.end!))
    const keyText = key && key.start! > start && key.end! < stop ? `${s.slice(key.start!, key.end!)} ` : ''
    s.overwrite(start, stop, `${keyText}${call.trimStart()}`)
  }
  return true
}

/** One JSX prop as an object entry: `a="x"` → `"a": "x"`, `{...rest}` → `...rest`, `disabled` → `"disabled": true`. */
function propEntry(attr: JSXAttribute | JSXSpreadAttribute, s: MagicString): string | null {
  if (attr.type === 'JSXSpreadAttribute') return `...${s.slice(attr.argument.start!, attr.argument.end!)}`
  const name = attr.name.type === 'JSXIdentifier' ? attr.name.name : `${attr.name.namespace.name}:${attr.name.name.name}`
  const value = attr.value
  if (!value) return `${JSON.stringify(name)}: true`
  // JSX strings don't process backslash escapes, so re-encode the decoded value.
  if (value.type === 'StringLiteral') return `${JSON.stringify(name)}: ${JSON.stringify(value.value)}`
  if (value.type === 'JSXExpressionContainer') {
    if (value.expression.type === 'JSXEmptyExpression') return null
    return `${JSON.stringify(name)}: ${s.slice(value.expression.start!, value.expression.end!)}`
  }
  return `${JSON.stringify(name)}: ${s.slice(value.start!, value.end!)}`
}
