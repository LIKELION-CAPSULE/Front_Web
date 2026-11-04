import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'

export function TypingMessage({ id, text, seen, onProgress, onTypingChange }: { id: string; text: string; seen: RefObject<Set<string>>; onProgress: () => void; onTypingChange: (id: string, typing: boolean) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shouldAnimate = useRef<boolean | null>(null)
  const reduced = useReducedMotion()
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    if (shouldAnimate.current === null) shouldAnimate.current = !seen.current.has(id)
    const animate = shouldAnimate.current && !reduced
    const fresh = shouldAnimate.current
    seen.current.add(id)
    const letters = Array.from(text)
    let frame = 0
    let release: number | undefined
    if (fresh) onTypingChange(id, true)
    function finish() {
      if (!node) return
      node.textContent = text
      node.dataset.typing = 'false'
      onProgress()
      if (fresh) release = window.setTimeout(() => {
        shouldAnimate.current = false
        onTypingChange(id, false)
      }, animate ? 240 : 800)
    }
    if (!animate) finish()
    else {
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
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(release)
      onTypingChange(id, false)
    }
  }, [id, text, seen, reduced, onProgress, onTypingChange])
  return <span className="typing-message"><span className="sr-only">{text}</span><span ref={ref} aria-hidden="true">{text}</span></span>
}
