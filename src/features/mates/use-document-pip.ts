import { useEffect, useState, useSyncExternalStore } from 'react'
import { DocumentPipController, documentPipApi } from './document-pip'

/** Mirror linked/inline styles, including lazy-loaded CSS, without accessing cross-origin cssRules. */
function mirrorStyles(source: Document, target: Document) {
  target.title = 'CAPSULE'
  target.documentElement.lang = source.documentElement.lang || 'ko'
  target.documentElement.className = source.documentElement.className
  target.documentElement.dataset.connectionPip = 'true'
  const base = target.createElement('base')
  base.href = source.baseURI
  target.head.append(base)
  let copies: Node[] = []
  const copy = () => {
    copies.forEach(node => node.parentNode?.removeChild(node))
    copies = [...source.head.querySelectorAll('style, link[rel="stylesheet"]')].map(node => node.cloneNode(true))
    target.head.append(...copies)
  }
  copy()
  const observer = new MutationObserver(copy)
  observer.observe(source.head, { subtree: true, childList: true, characterData: true, attributes: true })
  return () => { observer.disconnect(); copies.forEach(node => node.parentNode?.removeChild(node)); base.remove() }
}

export function useDocumentPip() {
  const [controller] = useState(() => new DocumentPipController(documentPipApi(window)))
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  useEffect(() => () => controller.close(), [controller])
  useEffect(() => {
    const pip = snapshot.window
    if (!pip) return
    const restore = mirrorStyles(document, pip.document)
    const leaving = () => controller.close()
    window.addEventListener('pagehide', leaving)
    return () => { restore(); window.removeEventListener('pagehide', leaving) }
  }, [snapshot.window, controller])
  return { ...snapshot, open: controller.open, close: controller.close }
}
