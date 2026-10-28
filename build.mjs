import * as esbuild from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * Two outputs, both plain JavaScript so the host app never has to compile anything:
 *
 * - `dist/client.js` — everything that runs in the page (panel, overlay, React reading).
 *   Preact is bundled in, so the panel has its own UI library and never shares the
 *   host's React.
 * - `dist/vite.js` — the Vite plugin the host's `vite.config.ts` loads.
 * - `site/design-mode.js` — the client again, minified, for the landing page.
 */
const watch = process.argv.includes('--watch')

const builds = [
  {
    entryPoints: ['src/client/index.tsx'],
    outfile: 'dist/client.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    sourcemap: 'inline',
    logLevel: 'info',
  },
  // The same client, minified, for the landing page to run on itself.
  {
    entryPoints: ['src/client/index.tsx'],
    outfile: 'site/design-mode.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    minify: true,
    logLevel: 'info',
  },
  {
    entryPoints: ['src/vite.ts'],
    outfile: 'dist/vite.js',
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    packages: 'external',
    logLevel: 'info',
  },
]

// The plugin's types, written by hand: one default export, so a compiler run isn't worth it.
mkdirSync('dist', { recursive: true })
writeFileSync('dist/vite.d.ts', "import type { Plugin } from 'vite'\n\nexport default function designMode(): Plugin\n")

if (watch) {
  for (const options of builds) await (await esbuild.context(options)).watch()
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)))
}
