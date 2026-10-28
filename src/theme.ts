import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** One design token the app defines itself, e.g. `--color-card` in a Tailwind `@theme` block. */
export interface ThemeToken {
  name: string
  value: string
  /** The section heading it sits under in the source ("Surfaces"), if the file has one. */
  group: string | null
  file: string
}

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.next', '.vite'])
const MAX_FILES = 300

/**
 * The app's own tokens: every custom property declared in a Tailwind v4 `@theme`
 * block in the project's CSS.
 *
 * These have to come from the source. On the page, Tailwind puts the app's tokens and
 * its own built-in scale (`--spacing`, `--text-sm`, …) side by side on `:root`, and
 * nothing there says which is which.
 */
export function readThemeTokens(root: string): ThemeToken[] {
  const tokens: ThemeToken[] = []
  const seen = new Set<string>()
  for (const file of cssFiles(root)) {
    const source = readFileSync(file, 'utf8')
    for (const block of themeBlocks(source)) {
      for (const token of tokensIn(block)) {
        if (seen.has(token.name)) continue
        seen.add(token.name)
        tokens.push({ ...token, file: relative(root, file) })
      }
    }
  }
  return tokens
}

function cssFiles(root: string): string[] {
  const files: string[] = []
  const walk = (dir: string, depth: number) => {
    if (depth > 8 || files.length >= MAX_FILES) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue
      const path = join(dir, entry)
      const stat = statSync(path, { throwIfNoEntry: false })
      if (stat?.isDirectory()) walk(path, depth + 1)
      else if (stat?.isFile() && entry.endsWith('.css')) files.push(path)
    }
  }
  walk(root, 0)
  return files
}

/** The insides of every `@theme { … }` block, with nested blocks (like `@keyframes`) cut out. */
function themeBlocks(source: string): string[] {
  const blocks: string[] = []
  const opener = /@theme\b[^{]*\{/g
  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    let depth = 1
    let i = match.index + match[0].length
    let topLevel = ''
    for (; i < source.length && depth > 0; i++) {
      const ch = source[i]
      if (ch === '/' && source[i + 1] === '*') {
        const end = source.indexOf('*/', i + 2)
        const comment = source.slice(i, end === -1 ? source.length : end + 2)
        if (depth === 1) topLevel += comment
        i += comment.length - 1
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (depth === 1) topLevel += ch
    }
    blocks.push(topLevel)
    opener.lastIndex = i
  }
  return blocks
}

function tokensIn(block: string): Omit<ThemeToken, 'file'>[] {
  const tokens: Omit<ThemeToken, 'file'>[] = []
  let group: string | null = null
  const pattern = /\/\*([\s\S]*?)\*\/|(--[\w-]+)\s*:\s*([^;]+);/g
  for (let match = pattern.exec(block); match; match = pattern.exec(block)) {
    if (match[1] !== undefined) {
      group = headingOf(match[1]) ?? group
      continue
    }
    const name = match[2]
    // Animations are tokens too, but nothing a design panel would offer in a picker.
    if (name.startsWith('--animate-')) continue
    tokens.push({ name, value: match[3].trim().replace(/\s+/g, ' '), group })
  }
  return tokens
}

/**
 * A comment counts as a section heading when it's marked like one (`── Surfaces ──`)
 * or is a short label (`Header and control tokens — match Figma exactly`, up to its
 * dash). Longer prose comments are explanations, not headings.
 */
function headingOf(comment: string): string | null {
  const firstLine = comment.trim().split('\n')[0].trim()
  const marked = firstLine.match(/^[─—=*-]{2,}\s*(.+?)\s*[─—=*-]*$/)
  if (marked) return marked[1]
  const label = firstLine.split(/\s+[—–-]\s+/)[0].replace(/[.:]$/, '')
  return comment.trim().includes('\n') || label.length > 32 ? null : label
}
