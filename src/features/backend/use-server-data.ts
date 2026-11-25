import { useCallback, useEffect, useRef, useState } from 'react'

export type ServerData<T> =
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: T | null; error: string }

/**
 * Reads one server view for `key` (null: nothing to read yet). A new key starts a new read and the previous answer is
 * ignored when it arrives late (filters changed meanwhile); the last good data stays shown while the next loads.
 * `retry()` reads the same key again. `scope` (default: the key) limits what is kept: pass the account so a filter change
 * keeps the last answer on screen while another account starts empty.
 */
export function useServerData<T>(key: string | null, load: () => Promise<T>, scope: string | null = key): ServerData<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  /** The answer and the read it belongs to (`key#attempt`); a newer read shows as loading with the last data. */
  const [state, setState] = useState<{ token: string | null; value: ServerData<T> }>({ token: null, value: { status: 'loading', data: null, error: null } })
  /** Kept only within one `scope` (an account): another account never sees the previous one's data. */
  const [last, setLast] = useState<{ scope: string | null; data: T } | null>(null)
  const lastData = last && last.scope === scope ? last.data : null
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  const token = key === null ? null : `${key}#${attempt}`

  useEffect(() => {
    if (token === null) return
    let current = true
    loadRef.current().then(
      data => {
        if (!current) return
        setState({ token, value: { status: 'ready', data, error: null } })
        setLast({ scope, data })
      },
      reason => {
        if (!current) return
        setState({ token, value: { status: 'error', data: null, error: reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.' } })
      },
    )
    // A newer read (or leaving) drops this one's answer.
    return () => { current = false }
  }, [token, scope])

  const retry = useCallback(() => setAttempt(value => value + 1), [])
  if (state.token !== token) return { status: 'loading', data: lastData, error: null, retry }
  if (state.value.status === 'error') return { ...state.value, data: lastData, retry }
  return { ...state.value, retry }
}
