import { useEffect, useRef } from 'react'

export type CapsuleIntroProps = {
  /** The record has loaded: the pill stops shaking at the end of the current cycle and opens. */
  ready: boolean
  /** The halves start to part; the card reveal starts here. */
  onOpen: () => void
  /** The canvas has faded out. */
  onDone: () => void
}

/**
 * Stands in for the capsule when WebGL is unavailable or the three.js chunk failed to load: the card still flips
 * in once the record is ready. Kept apart from CapsuleIntro so importing it does not pull three.js in.
 */
export function CapsuleIntroFallback({ ready, onOpen, onDone }: CapsuleIntroProps) {
  const fired = useRef(false)
  useEffect(() => {
    if (!ready || fired.current) return
    fired.current = true
    onOpen()
    onDone()
  }, [ready, onOpen, onDone])
  return null
}
