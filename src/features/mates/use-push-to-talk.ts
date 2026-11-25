import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { holdKeyApplies, PushToTalk, speechRecognitionFactory } from './push-to-talk'

const privacyKey = (userId: number) => `capsule-stt-notice:v1:${userId}`
const PRIVACY_MS = 7000

/** Who holds the press: the call screen's mic button, the PIP window's, or Space (T-8). One at a time. */
export type PressSource = 'dock' | 'pip' | 'key'

/**
 * 「누르고 말하기」 for the connection screen (push-to-talk.ts): the recognizer, Space held on the page or its PIP window
 * (T-8, `holdToTalk`), and the one-time notice that speech goes to the browser's recognition service.
 *
 * One press owner for the buttons and Space: a press ends when its owner lets go — and also when the focus leaves the
 * button, the window loses focus or is hidden or left, the PIP window closes, T-8 is turned off, or the screen goes
 * away — so listening never outlives the press (a missed keyup or pointerup cannot leave it on).
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
  const owner = useRef<PressSource | null>(null)
  /** The window the press happens in (a blur of the other window — e.g. clicking into PIP — does not end it). */
  const ownerWindow = useRef<Window | null>(null)
  useEffect(() => () => { owner.current = null; talk.cancel() }, [talk])

  const press = useCallback((source: PressSource, surface: Window | null = null) => {
    if (owner.current) return
    const before = talk.getSnapshot().status
    talk.start()
    if (!talk.listening) return
    owner.current = source
    ownerWindow.current = surface
    if (before === 'listening' || !userId) return
    // First use on this browser: say where the voice goes (saved as seen once a surface has shown it).
    let seen = false
    try { seen = localStorage.getItem(privacyKey(userId)) === '1' } catch { /* Show it this time. */ }
    if (!seen) setPrivacy(true)
  }, [talk, userId])
  /** The owner let go (or anything that ends a press): stop listening; the sentence then goes out. */
  const release = useCallback((source?: PressSource) => {
    if (source && owner.current && owner.current !== source) return
    owner.current = null
    ownerWindow.current = null
    talk.end()
  }, [talk])
  /** The notice was on screen: remember it for this browser. */
  const privacyShown = useCallback(() => {
    if (!userId) return
    try { localStorage.setItem(privacyKey(userId), '1') } catch { /* Shown again next time. */ }
  }, [userId])
  useEffect(() => {
    if (!privacy) return
    const timer = setTimeout(() => setPrivacy(false), PRIVACY_MS)
    return () => clearTimeout(timer)
  }, [privacy])

  const surfaces = windows.filter((value): value is Window => Boolean(value))
  const main = surfaces[0] ?? null
  const pip = surfaces[1] ?? null

  // A press never outlives the window: blur, hidden, left. The PIP window closing (or opening) ends it too.
  useEffect(() => {
    const list = [main, pip].filter((value): value is Window => Boolean(value))
    const handlers = list.map((surface) => {
      // Only the window the press lives in: clicking into the other window (PIP) blurs this one first.
      const blur = () => { if (!ownerWindow.current || ownerWindow.current === surface) release() }
      const end = () => release()
      const hidden = () => { if (surface.document.hidden && (!ownerWindow.current || ownerWindow.current === surface)) release() }
      surface.addEventListener('blur', blur)
      surface.addEventListener('pagehide', end)
      surface.document.addEventListener('visibilitychange', hidden)
      return () => {
        surface.removeEventListener('blur', blur)
        surface.removeEventListener('pagehide', end)
        surface.document.removeEventListener('visibilitychange', hidden)
      }
    })
    return () => {
      handlers.forEach((remove) => remove())
      release()
    }
  }, [main, pip, release])

  // T-8: Space held down (focus rules in holdKeyApplies), on the page and in the PIP window. Turning T-8 off (or the
  // listeners changing) ends a Space press.
  useEffect(() => {
    if (!holdToTalk || !talk.supported) return
    const down = (event: KeyboardEvent) => {
      const doc = (event.view ?? window).document
      if (!holdKeyApplies(event, doc)) return
      event.preventDefault()
      if (event.repeat || owner.current) return
      press('key', event.view ?? null)
    }
    const up = (event: KeyboardEvent) => {
      if (owner.current !== 'key' || (event.code !== 'Space' && event.key !== ' ')) return
      event.preventDefault()
      release('key')
    }
    const list = [main, pip].filter((value): value is Window => Boolean(value))
    for (const surface of list) {
      surface.addEventListener('keydown', down)
      surface.addEventListener('keyup', up)
    }
    return () => {
      for (const surface of list) {
        surface.removeEventListener('keydown', down)
        surface.removeEventListener('keyup', up)
      }
      if (owner.current === 'key') release('key')
    }
  }, [holdToTalk, talk, press, release, main, pip])

  const retry = useCallback(() => talk.retry(), [talk])
  const dismiss = useCallback(() => talk.dismiss(), [talk])
  const cancel = useCallback(() => { owner.current = null; ownerWindow.current = null; talk.cancel() }, [talk])
  return { snapshot, supported: talk.supported, press, release, retry, dismiss, cancel, privacy, privacyShown }
}
