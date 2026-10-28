import { parse } from '@babel/parser'
import type { Node, TSType, TSTypeElement } from '@babel/types'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

/**
 * What a component accepts, read from its TypeScript types: the "properties" the
 * panel can offer. A union of strings (`'primary' | 'quiet'`) is a variant with those
 * options; `boolean` is an on/off toggle; `string` and `number` are fields. Anything
 * else (callbacks, React nodes, objects) isn't something you'd set from a panel.
 */
export interface PropInfo {
  name: string
  kind: 'enum' | 'boolean' | 'string' | 'number'
  options?: string[]
  /** The default from the component's parameter list (`variant = 'quiet'`), as written. */
  default?: string | number | boolean
  /** First sentence of its doc comment. */
  doc?: string
}

export interface ComponentInfo {
  name: string
  /** Where the component is defined, relative to the project root. */
  file: string
  line: number
  props: PropInfo[]
}

type Program = Extract<Node, { type: 'File' }>['program']

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.vite', 'coverage'])
const parsed = new Map<string, Program | null>()
let nameIndex: Map<string, string[]> | null = null

/** Forget everything read so far. Called whenever a source file changes. */
export function clearPropCache() {
  parsed.clear()
  nameIndex = null
}

/**
 * Finds a component by name and reads its props. `hint` is a file it's probably
 * defined in (where its first element was written); failing that, the project is
 * searched for a declaration with that name.
 */
export function readComponent(root: string, name: string, hint: string | null): ComponentInfo | null {
  const candidates = [...(hint ? [resolve(root, hint)] : []), ...(indexOf(root).get(name) ?? [])]
  for (const file of new Set(candidates)) {
    const info = componentIn(file, name)
    if (info) return { ...info, file: relative(root, file) }
  }
  return null
}

function indexOf(root: string): Map<string, string[]> {
  if (nameIndex) return nameIndex
  const index = new Map<string, string[]>()
  const declaration = /(?:function|const|let|class)\s+([A-Z][\w$]*)/g
  const walk = (dir: string, depth: number) => {
    if (depth > 8) return
    for (const entry of safeReaddir(dir)) {
      if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue
      const path = join(dir, entry)
      const stat = statSync(path, { throwIfNoEntry: false })
      if (stat?.isDirectory()) walk(path, depth + 1)
      else if (stat?.isFile() && /\.[jt]sx?$/.test(entry) && !entry.endsWith('.d.ts')) {
        const source = readFileSync(path, 'utf8')
        for (const match of source.matchAll(declaration)) {
          const list = index.get(match[1]) ?? []
          if (list.includes(path)) continue
          // Exported declarations first: a local helper with the same name is less likely the one on screen.
          const exported = new RegExp(`export\\s+(?:default\\s+)?(?:function|const|let|class)\\s+${match[1]}\\b`).test(source)
          if (exported) list.unshift(path)
          else list.push(path)
          index.set(match[1], list)
        }
      }
    }
  }
  walk(root, 0)
  nameIndex = index
  return index
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function programOf(file: string): Program | null {
  if (parsed.has(file)) return parsed.get(file)!
  let program: Program | null = null
  if (existsSync(file)) {
    try {
      const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true })
      program = ast.program
    } catch {
      program = null
    }
  }
  parsed.set(file, program)
  return program
}

/** Top-level statements, looking through `export`. */
function statements(program: Program): Node[] {
  return program.body.map((s) => ((s.type === 'ExportNamedDeclaration' || s.type === 'ExportDefaultDeclaration') && s.declaration ? s.declaration : s))
}

function componentIn(file: string, name: string): Omit<ComponentInfo, 'file'> | null {
  const program = programOf(file)
  if (!program) return null

  for (const statement of statements(program)) {
    let fn: Node | null = null
    if (statement.type === 'FunctionDeclaration' && statement.id?.name === name) fn = statement
    if (statement.type === 'ClassDeclaration' && statement.id?.name === name) {
      return { name, line: statement.loc?.start.line ?? 0, props: classProps(statement, file) }
    }
    if (statement.type === 'VariableDeclaration') {
      for (const d of statement.declarations) {
        if (d.id.type === 'Identifier' && d.id.name === name && d.init) fn = unwrap(d.init)
      }
    }
    if (fn && (fn.type === 'FunctionDeclaration' || fn.type === 'FunctionExpression' || fn.type === 'ArrowFunctionExpression')) {
      return { name, line: statement.loc?.start.line ?? 0, props: functionProps(fn, file) }
    }
  }
  return null
}

/** Looks inside `memo(...)` and `forwardRef(...)` for the function itself. */
function unwrap(node: Node): Node | null {
  if (node.type === 'CallExpression' && node.arguments[0]) return unwrap(node.arguments[0] as Node)
  if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression') return unwrap(node.expression)
  return node
}

function functionProps(fn: Extract<Node, { type: 'FunctionDeclaration' | 'FunctionExpression' | 'ArrowFunctionExpression' }>, file: string): PropInfo[] {
  const param = fn.params[0]
  if (!param) return []
  const defaults = new Map<string, string | number | boolean>()
  let annotation: Node | null = null

  if (param.type === 'ObjectPattern') {
    annotation = param.typeAnnotation?.type === 'TSTypeAnnotation' ? param.typeAnnotation.typeAnnotation : null
    for (const prop of param.properties) {
      if (prop.type !== 'ObjectProperty' || prop.key.type !== 'Identifier') continue
      if (prop.value.type === 'AssignmentPattern') {
        const value = literal(prop.value.right)
        if (value !== undefined) defaults.set(prop.key.name, value)
      }
    }
  } else if (param.type === 'Identifier') {
    annotation = param.typeAnnotation?.type === 'TSTypeAnnotation' ? param.typeAnnotation.typeAnnotation : null
  } else if (param.type === 'AssignmentPattern' && param.left.type === 'ObjectPattern') {
    annotation = param.left.typeAnnotation?.type === 'TSTypeAnnotation' ? param.left.typeAnnotation.typeAnnotation : null
  }
  if (!annotation) return []

  return membersOf(annotation as TSType, file, 0).map((p) => (defaults.has(p.name) ? { ...p, default: defaults.get(p.name) } : p))
}

/** `class X extends Component<Props>`: the first type argument. */
function classProps(node: Extract<Node, { type: 'ClassDeclaration' }>, file: string): PropInfo[] {
  const params = node.superTypeParameters
  const first = params && 'params' in params ? params.params[0] : null
  return first ? membersOf(first as TSType, file, 0) : []
}

function literal(node: Node): string | number | boolean | undefined {
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral' || node.type === 'BooleanLiteral') return node.value
  return undefined
}

/** The settable props of a props type, following local type names, intersections and `extends`. */
function membersOf(type: TSType, file: string, depth: number): PropInfo[] {
  if (depth > 4) return []
  if (type.type === 'TSTypeLiteral') return type.members.flatMap((m) => memberInfo(m, file, depth))
  if (type.type === 'TSIntersectionType') return type.types.flatMap((t) => membersOf(t, file, depth + 1))
  if (type.type === 'TSTypeReference' && type.typeName.type === 'Identifier') {
    const found = findType(type.typeName.name, file)
    if (!found) return []
    const { node, file: where } = found
    if (node.type === 'TSInterfaceDeclaration') {
      const inherited = (node.extends ?? []).flatMap((h) =>
        h.expression.type === 'Identifier' ? membersOfName(h.expression.name, where, depth + 1) : [],
      )
      const own = node.body.body.flatMap((m) => memberInfo(m, where, depth))
      const names = new Set(own.map((p) => p.name))
      return [...inherited.filter((p) => !names.has(p.name)), ...own]
    }
    if (node.type === 'TSTypeAliasDeclaration') return membersOf(node.typeAnnotation, where, depth + 1)
  }
  return []
}

function membersOfName(name: string, file: string, depth: number): PropInfo[] {
  return membersOf({ type: 'TSTypeReference', typeName: { type: 'Identifier', name } } as TSType, file, depth)
}

function memberInfo(member: TSTypeElement, file: string, depth: number): PropInfo[] {
  if (member.type !== 'TSPropertySignature' || member.key.type !== 'Identifier' || !member.typeAnnotation) return []
  const kind = kindOf(member.typeAnnotation.typeAnnotation, file, depth)
  if (!kind) return []
  const doc = member.leadingComments?.map((c) => c.value).join('\n')
  return [{ name: member.key.name, ...kind, ...(doc ? { doc: firstSentence(doc) } : {}) }]
}

function kindOf(type: TSType, file: string, depth: number): Pick<PropInfo, 'kind' | 'options'> | null {
  if (depth > 6) return null
  switch (type.type) {
    case 'TSBooleanKeyword':
      return { kind: 'boolean' }
    case 'TSStringKeyword':
      return { kind: 'string' }
    case 'TSNumberKeyword':
      return { kind: 'number' }
    case 'TSLiteralType':
      return type.literal.type === 'StringLiteral' ? { kind: 'enum', options: [type.literal.value] } : null
    case 'TSParenthesizedType':
      return kindOf(type.typeAnnotation, file, depth + 1)
    case 'TSUnionType': {
      const parts = type.types
        .filter((t) => t.type !== 'TSUndefinedKeyword' && t.type !== 'TSNullKeyword')
        .map((t) => kindOf(t, file, depth + 1))
      if (parts.length === 0 || parts.some((p) => !p)) {
        // `boolean | undefined` style unions with something unreadable inside: give up on them.
        return null
      }
      if (parts.every((p) => p!.kind === 'enum')) return { kind: 'enum', options: [...new Set(parts.flatMap((p) => p!.options ?? []))] }
      if (parts.every((p) => p!.kind === parts[0]!.kind)) return parts[0]
      return null
    }
    case 'TSTypeReference': {
      if (type.typeName.type !== 'Identifier') return null
      const found = findType(type.typeName.name, file)
      if (found?.node.type === 'TSTypeAliasDeclaration') return kindOf(found.node.typeAnnotation, found.file, depth + 1)
      return null
    }
    default:
      return null
  }
}

/** A type or interface by name: declared in this file, or imported into it from another local file. */
function findType(name: string, file: string, depth = 0): { node: Node; file: string } | null {
  const program = programOf(file)
  if (!program || depth > 3) return null
  for (const statement of statements(program)) {
    if ((statement.type === 'TSInterfaceDeclaration' || statement.type === 'TSTypeAliasDeclaration') && statement.id.name === name) {
      return { node: statement, file }
    }
  }
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || !statement.source.value.startsWith('.')) continue
    const spec = statement.specifiers.find((s) => s.local.name === name)
    if (!spec) continue
    const imported = spec.type === 'ImportSpecifier' && spec.imported.type === 'Identifier' ? spec.imported.name : name
    const target = resolveImport(dirname(file), statement.source.value)
    if (target) return findType(imported, target, depth + 1)
  }
  return null
}

function resolveImport(dir: string, source: string): string | null {
  const base = resolve(dir, source)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function firstSentence(comment: string): string {
  const text = comment.replace(/^\s*\*+/gm, '').replace(/\s+/g, ' ').trim()
  // A full stop followed by a capital (or the end), so "e.g. a" doesn't end the sentence.
  const end = text.search(/\.(\s+[A-Z]|$)/)
  return end === -1 ? text : text.slice(0, end + 1)
}
