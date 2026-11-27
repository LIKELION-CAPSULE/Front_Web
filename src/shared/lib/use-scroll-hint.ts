import { useEffect, useState, type RefObject } from 'react'

/**
 * Marks a scroll area with `data-more-above` / `data-more-below` while there is content out of view that way (the CSS
 * of each area fades that edge), and returns the same two flags. Follows scrolling, size changes and content changes.
 */
export function useScrollHint(target: RefObject<HTMLElement | null>) {
  const [state, setState] = useState({ above: false, below: false })
  useEffect(() => {
    const node = target.current
    if (!node) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const above = node.scrollTop > 2
        const below = node.scrollHeight - node.clientHeight - node.scrollTop > 2
        node.toggleAttribute('data-more-above', above)
        node.toggleAttribute('data-more-below', below)
        setState((previous) => (previous.above === above && previous.below === below ? previous : { above, below }))
      })
    }
    update()
    node.addEventListener('scroll', update, { passive: true })
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    resize?.observe(node)
    for (const child of node.children) resize?.observe(child)
    // A form swapped in (another route) or an error line added changes the content height without a resize of the area.
    const mutation = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      for (const child of node.children) resize?.observe(child)
      update()
    })
    mutation?.observe(node, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      node.removeEventListener('scroll', update)
      resize?.disconnect()
      mutation?.disconnect()
      node.removeAttribute('data-more-above')
      node.removeAttribute('data-more-below')
    }
  }, [target])
  return state
}
