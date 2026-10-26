import { createContext, useContext } from 'react'
import type { Dispatch } from 'react'
import type { DemoAction } from './reducer'
import type { DemoState } from './types'

export const DemoContext = createContext<{
  state: DemoState
  dispatch: Dispatch<DemoAction>
  storageAvailable: boolean
} | null>(null)

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('useDemo must be used within DemoProvider')
  return context
}
