import { useEffect, useReducer, useState } from 'react'
import type { ReactNode } from 'react'
import { DemoContext } from './demo-context'
import { DEMO_STORAGE_KEY, loadDemoState } from './persistence'
import { demoReducer } from './reducer'

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, loadDemoState)
  const [storageAvailable, setStorageAvailable] = useState(true)
  useEffect(() => {
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // The demo remains usable in memory if storage is denied/full.
      queueMicrotask(() => setStorageAvailable(false))
    }
  }, [state])
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <DemoContext value={{ state, dispatch, storageAvailable }}>{children}</DemoContext>
}
