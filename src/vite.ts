import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { addSourceInfo } from './jsx'
import { clearPropCache, readComponent } from './propTypes'
import { readThemeTokens } from './theme'

const CLIENT_URL = '/@design-mode/client.js'
const TOKENS_URL = '/@design-mode/tokens.json'
const COMPONENT_URL = '/@design-mode/component.json'

/**
 * Adds Design Mode to a Vite app while it runs in dev (`vite`), never to a build.
 *
 * The client is served as a finished file straight from this package rather than
 * going through Vite's pipeline, so the host's own plugins (React's JSX transform,
 * in particular) never touch it. It's read on every request, so rebuilding this
 * package and reloading the page is enough to pick up a change.
 */
export default function designMode(): Plugin {
  const clientPath = fileURLToPath(new URL('./client.js', import.meta.url))
  let root = process.cwd()

  return {
    name: 'design-mode',
    apply: 'serve',
    // Before React's plugin, so the JSX is still JSX when it gets here.
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.watcher.on('change', clearPropCache)
      server.watcher.on('add', clearPropCache)

      server.middlewares.use(CLIENT_URL, (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript')
        res.setHeader('Cache-Control', 'no-store')
        res.end(readFileSync(clientPath))
      })
      // Read fresh on every request, so editing the theme shows up on reload.
      server.middlewares.use(TOKENS_URL, (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(readThemeTokens(root)))
      })
      // A component's props, from its TypeScript types: /@design-mode/component.json?name=Button&hint=src/ui/kit/Button.tsx
      server.middlewares.use(COMPONENT_URL, (req, res) => {
        const params = new URL(req.url ?? '', 'http://x').searchParams
        const name = params.get('name') ?? ''
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(JSON.stringify(name ? readComponent(root, name, params.get('hint')) : null))
      })
    },
    transform(code, id) {
      const file = id.split('?')[0]
      if (!/\.[jt]sx$/.test(file) || file.includes('/node_modules/') || !code.includes('<')) return null
      return addSourceInfo(code, relative(root, file))
    },
    transformIndexHtml() {
      // First in <head>, so its key and click listeners are registered before the
      // app's own, and it's in place before React loads (see the client's devtools hook).
      return [{ tag: 'script', attrs: { type: 'module', src: CLIENT_URL }, injectTo: 'head-prepend' }]
    },
  }
}
