import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import type { ReceiptPrinterScene } from '../receipt-printer-scene'

export function ReceiptPrinter({ printing, outletRef }: { printing: boolean; outletRef: RefObject<HTMLDivElement | null> }) {
  const host = useRef<HTMLDivElement>(null)
  const canvasHost = useRef<HTMLDivElement>(null)
  const scene = useRef<ReceiptPrinterScene | null>(null)
  const latestPrinting = useRef(printing)
  useLayoutEffect(() => {
    latestPrinting.current = printing
    scene.current?.setPrinting(printing)
  }, [printing])
  useEffect(() => {
    const container = host.current!
    const surface = canvasHost.current!
    const outlet = outletRef.current!
    let cancelled = false
    const media = window.matchMedia('(max-width: 699px)')
    function positionFallback() {
      const bounds = container.getBoundingClientRect()
      const paper = outlet.getBoundingClientRect()
      container.style.setProperty('--printer-mouth-x', `${paper.left - bounds.left + (media.matches ? paper.width / 2 : 0)}px`)
      container.style.setProperty('--printer-mouth-y', `${paper.top - bounds.top + (media.matches ? 0 : paper.height / 2)}px`)
      container.style.setProperty('--printer-span', `${media.matches ? paper.width : paper.height}px`)
    }
    const observer = new ResizeObserver(positionFallback)
    observer.observe(container)
    observer.observe(outlet)
    media.addEventListener('change', positionFallback)
    positionFallback()
    // Load three.js only when the completion screen is actually opened.
    void import('../receipt-printer-scene').then(({ createReceiptPrinterScene }) => {
      if (cancelled) return
      try {
        scene.current = createReceiptPrinterScene(surface, outlet)
        scene.current.setPrinting(latestPrinting.current)
        container.dataset.renderer = 'webgl'
      } catch {
        surface.replaceChildren()
        container.dataset.renderer = 'fallback'
      }
    }).catch(() => { /* Keep the CSS printer if the lazy chunk cannot load. */ })
    return () => {
      cancelled = true
      observer.disconnect()
      media.removeEventListener('change', positionFallback)
      scene.current?.dispose()
      scene.current = null
    }
  }, [outletRef])
  return (
    <div ref={host} className="receipt-printer" aria-hidden="true">
      <div className="receipt-printer-fallback">
        <div className="receipt-printer-fallback-cover"><span>CAPSULE</span></div>
        <span className="receipt-printer-light" />
        <span className="receipt-printer-slot" />
      </div>
      <div ref={canvasHost} className="receipt-printer-scene" />
    </div>
  )
}
