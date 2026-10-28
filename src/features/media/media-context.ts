import { createContext, useContext } from 'react'
import type { DeviceController } from './device-controller'
import type { MediaSnapshot, Observation, VisionStatus } from './types'

export const MediaContext = createContext<{
  devices: MediaSnapshot
  controller: DeviceController
  vision: VisionStatus | null
  observation: Observation | null
  retryVision: () => void
  flushFocus: () => void
} | null>(null)

export function useMedia() {
  const value = useContext(MediaContext)
  if (!value) throw new Error('useMedia requires MediaProvider')
  return value
}
