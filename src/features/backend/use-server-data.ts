import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveServerData, type ServerData, type ServerDataInput } from './server-data'

export type { ServerData } from './server-data'

/**
 * Reads one server view for `key` (null: nothing to read yet). A new key starts a new read and the previous answer is
 * ignored when it arrives late (filters changed meanwhile); the last good data stays shown while the next loads, with
 * the key it came from (`dataKey`, server-data.ts): a screen shows its sums only for the key it asked for.
 * `retry()` reads the same key again. `scope` (default: the key) limits what is kept: pass the account so a filter change
 * keeps the last answer on screen while another account starts empty.
 */
export function useServerData<T>(key: string | null, load: () => Promise<T>, scope: string | null = key): ServerData<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  /** The answer and the read it belongs to (`key#attempt`); a newer read shows as loading with the last data. */
  const [state, setState] = useState<ServerDataInput<T>['state']>({ token: null, value: { status: 'loading', data: null, error: null } })
  /** Kept only within one `scope` (an account): another account never sees the previous one's data. */
  const [last, setLast] = useState<ServerDataInput<T>['last']>(null)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })
  const token = key === null ? null : `${key}#${attempt}`

  useEffect(() => {
    if (token === null || key === null) return
    let current = true
    loadRef.current().then(
      data => {
        if (!current) return
        setState({ token, value: { status: 'ready', data, error: null } })
        setLast({ scope, key, data })
      },
      reason => {
        if (!current) return
        setState({ token, value: { status: 'error', data: null, error: reason instanceof Error ? reason.message : '요청을 처리하지 못했어요.' } })
      },
    )
    // A newer read (or leaving) drops this one's answer.
    return () => { current = false }
  }, [token, key, scope])

  const retry = useCallback(() => setAttempt(value => value + 1), [])
  return { ...resolveServerData({ key, token, state, last, scope }), retry }
}
