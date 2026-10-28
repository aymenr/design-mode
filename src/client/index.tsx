import { render } from 'preact'
import { Controller } from './controller'
import { installLiveProps } from './liveProps'
import { App } from './ui/App'
import { css, css2 } from './ui/css'

declare global {
  interface Window {
    __designMode?: Controller
  }
}

/**
 * Mounts Design Mode into the page.
 *
 * Everything lives in a shadow root (a sealed-off corner of the page whose styles
 * can't mix with the page's) on an element attached to <html>, outside <body>. That
 * keeps it out of the app's React tree and out of reach of code that walks <body>,
 * like midiplay's `useInertOutside`, which disables everything behind a full-screen view.
 */
function mount() {
  if (window.__designMode) return

  const host = document.createElement('design-mode')
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;'
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css + css2
  const container = document.createElement('div')
  shadow.append(style, container)

  const ctl = new Controller(host)
  ctl.install()
  window.__designMode = ctl
  render(<App ctl={ctl} />, container)
}

// Before anything else: React looks for its dev hook the moment it loads.
installLiveProps()
mount()
