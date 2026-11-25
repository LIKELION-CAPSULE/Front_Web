import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { holdKeyApplies, PushToTalk, speechRecognitionFactory } from './push-to-talk'

const privacyKey = (userId: number) => `capsule-stt-notice:v1:${userId}`
const PRIVACY_MS = 7000

/**
 * 「누르고 말하기」 for the connection screen (push-to-talk.ts): the recognizer, Space held on the page or its PIP
 * window (T-8, `holdToTalk`), and the one-time notice that speech goes to the browser's recognition service.
 */
export function usePushToTalk({ holdToTalk, windows, userId, send, canListen }: {
  holdToTalk: boolean
  /** The connection screen's window and, while open, the PIP window. */
  windows: readonly (Window | null | undefined)[]
  userId: number | null | undefined
  send: (text: string) => Promise<boolean> | boolean
  canListen: () => boolean
}) {
  const [talk] = useState(() => new PushToTalk(speechRecognitionFactory(typeof window === 'undefined' ? null : window), {
    send: () => false,
    canListen: () => false,
  }))
  useEffect(() => { talk.setHandlers({ send, canListen }) })
  const snapshot = useSyncExternalStore(talk.subscribe, talk.getSnapshot)
  const [privacy, setPrivacy] = useState(false)
  useEffect(() => () => talk.cancel(), [talk])

  const start = useCallback(() => {
    const before = talk.getSnapshot().status
    talk.start()
    if (before !== 'idle' || talk.getSnapshot().status !== 'listening' || !userId) return
    // First use on this browser: say where the voice goes.
    let seen = false
    try { seen = localStorage.getItem(privacyKey(userId)) === '1'; if (!seen) localStorage.setItem(privacyKey(userId), '1') } catch { /* Show it this time. */ }
    if (!seen) setPrivacy(true)
  }, [talk, userId])
  const end = useCallback(() => talk.end(), [talk])
  useEffect(() => {
    if (!privacy) return
    const timer = setTimeout(() => setPrivacy(false), PRIVACY_MS)
    return () => clearTimeout(timer)
  }, [privacy])

  // T-8: Space held down (focus rules in holdKeyApplies), on the page and in the PIP window.
  const surfaces = windows.filter((value): value is Window => Boolean(value))
  const surfaceKey = surfaces.length
  useEffect(() => {
    if (!holdToTalk || !talk.supported) return
    let held = false
    const down = (event: KeyboardEvent) => {
      const doc = (event.view ?? window).document
      if (!holdKeyApplies(event, doc)) return
      event.preventDefault()
      if (event.repeat || held) return
      held = true
      start()
    }
    const up = (event: KeyboardEvent) => {
      if (!held || (event.code !== 'Space' && event.key !== ' ')) return
      event.preventDefault()
      held = false
      end()
    }
    const blur = () => { if (held) { held = false; end() } }
    for (const surface of surfaces) {
      surface.addEventListener('keydown', down)
      surface.addEventListener('keyup', up)
      surface.addEventListener('blur', blur)
    }
    return () => {
      for (const surface of surfaces) {
        surface.removeEventListener('keydown', down)
        surface.removeEventListener('keyup', up)
        surface.removeEventListener('blur', blur)
      }
    }
    // The surfaces are the page window and the PIP window: their count stands for the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdToTalk, talk, start, end, surfaceKey, surfaces[1]])

  return { snapshot, supported: talk.supported, start, end, cancel: talk.cancel, privacy }
}
