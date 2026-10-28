import { useEffect, useRef } from 'preact/hooks'
import type { Controller } from '../controller'
import { rectOf, type LayerNode } from '../tree'

/**
 * The outlines drawn over the page: dashed for what's under the pointer, solid for
 * what's selected. They follow their element every frame, so they stay put while
 * the page scrolls, animates or reflows. Positions are written straight to the DOM
 * rather than through state, to keep a re-render out of every frame.
 */
export function Overlay({ ctl }: { ctl: Controller }) {
  const hoverRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const { hover, selected, panelOpen } = ctl.state
      place(hoverRef.current, hover && hover !== selected ? hover : null, true)
      place(selectedRef.current, panelOpen ? selected : null, false)
      placePreview(previewRef.current, ctl.state.scopePreview)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [ctl])

  return (
    <>
      <div ref={selectedRef} class="box">
        <span class="box-tag" />
      </div>
      <div ref={hoverRef} class="box hover">
        <span class="box-tag" />
      </div>
      <div ref={previewRef} />
    </>
  )
}

function place(box: HTMLDivElement | null, node: LayerNode | null, detailed: boolean) {
  if (!box) return
  const rect = node ? rectOf(node) : null
  if (!node || !rect) {
    box.style.display = 'none'
    return
  }
  box.style.display = 'block'
  box.style.left = `${rect.left - 2}px`
  box.style.top = `${rect.top - 2}px`
  box.style.width = `${rect.width + 4}px`
  box.style.height = `${rect.height + 4}px`

  const tag = box.firstElementChild as HTMLElement
  const text = detailed ? `${node.name}\u0000${details(node, rect)}` : node.name
  if (tag.dataset.text !== text) {
    tag.dataset.text = text
    tag.textContent = node.name
    if (detailed) {
      const em = document.createElement('em')
      em.textContent = details(node, rect)
      tag.append(em)
    }
  }
  // Flip the name tag under the box when there's no room above it.
  tag.classList.toggle('below', rect.top < 26)
}

/** Outlines everything a scope option would cover, while you hover it. */
const MAX_PREVIEW = 80
function placePreview(container: HTMLDivElement | null, nodes: LayerNode[] | null) {
  if (!container) return
  const list = (nodes ?? []).slice(0, MAX_PREVIEW)
  while (container.children.length < list.length) {
    const box = document.createElement('div')
    box.className = 'box preview'
    container.append(box)
  }
  Array.from(container.children).forEach((child, i) => {
    const box = child as HTMLDivElement
    const rect = i < list.length ? rectOf(list[i]) : null
    if (!rect) {
      box.style.display = 'none'
      return
    }
    box.style.display = 'block'
    box.style.left = `${rect.left - 2}px`
    box.style.top = `${rect.top - 2}px`
    box.style.width = `${rect.width + 4}px`
    box.style.height = `${rect.height + 4}px`
  })
}

/** "primary · 78×30": the component's variant when it has one, then its size. */
function details(node: LayerNode, rect: DOMRect): string {
  const variant = node.kind === 'component' ? node.fiber?.memoizedProps?.variant : undefined
  const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`
  return typeof variant === 'string' ? `${variant} · ${size}` : size
}
