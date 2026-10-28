import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'

export function TypingMessage({ id, text, seen, onProgress }: { id: string; text: string; seen: RefObject<Set<string>>; onProgress: () => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shouldAnimate = useRef<boolean | null>(null)
  const reduced = useReducedMotion()
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    if (shouldAnimate.current === null) shouldAnimate.current = !seen.current.has(id)
    const animate = shouldAnimate.current && !reduced
    seen.current.add(id)
    const letters = Array.from(text)
    let frame = 0
    function finish() {
      if (!node) return
      node.textContent = text
      node.dataset.typing = 'false'
      shouldAnimate.current = false
      onProgress()
    }
    if (!animate) { finish(); return }
    node.textContent = ''
    node.dataset.typing = 'true'
    const start = performance.now()
    const pace = Math.max(15, Math.min(32, 2500 / letters.length))
    let visible = -1
    function tick(now: number) {
      const count = Math.min(letters.length, Math.floor((now - start) / pace) + 1)
      if (node && count !== visible) { node.textContent = letters.slice(0, count).join(''); visible = count; onProgress() }
      if (count < letters.length) frame = requestAnimationFrame(tick)
      else finish()
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [id, text, seen, reduced, onProgress])
  return <span className="typing-message"><span className="sr-only">{text}</span><span ref={ref} aria-hidden="true">{text}</span></span>
}
